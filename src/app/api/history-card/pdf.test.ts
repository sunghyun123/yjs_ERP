import { describe, expect, it } from 'vitest'
import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib'
import { isPdf, 첫쪽만, PdfError } from './pdf'

async function 쪽수가(n: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < n; i++) doc.addPage([200 + i, 200])
  return doc.save()
}

describe('isPdf', () => {
  it('%PDF- 로 시작하면 true', async () => expect(isPdf(await 쪽수가(1))).toBe(true))
  it('확장자만 pdf인 다른 파일은 false', () => expect(isPdf(new TextEncoder().encode('PK\x03\x04zip'))).toBe(false))
  it('5바이트보다 짧으면 false', () => expect(isPdf(new Uint8Array([0x25]))).toBe(false))
})

/** 결과 PDF의 간접 객체를 전부 훑어 '쪽 딕셔너리 수'와 '스트림 안에 이 글자가 있나'를 본다 */
async function 훑기(result: Uint8Array) {
  const out = await PDFDocument.load(result)
  let 쪽딕셔너리 = 0
  const 스트림들: string[] = []
  for (const [, obj] of out.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream) {
      스트림들.push(Buffer.from(decodePDFRawStream(obj).decode()).toString('latin1'))
    } else if ('get' in obj && typeof obj.get === 'function') {
      if (String(obj.get(PDFName.of('Type'))) === '/Page') 쪽딕셔너리++
    }
  }
  return { 쪽딕셔너리, 있나: (글자: string) => 스트림들.some(t => t.includes(글자)) }
}

describe('첫쪽만', () => {
  it('3쪽 PDF에서 첫 쪽만 남긴다', async () => {
    const out = await PDFDocument.load(await 첫쪽만(await 쪽수가(3)))
    expect(out.getPageCount()).toBe(1)
    expect(out.getPage(0).getWidth()).toBe(200) // 0번 쪽 (너비 200+0)
  })
  it('열 수 없는 PDF는 PdfError', async () => {
    const 깨진 = new TextEncoder().encode('%PDF-1.7 garbage')
    await expect(첫쪽만(깨진)).rejects.toBeInstanceOf(PdfError)
  })

  it('1쪽 링크(/Annots)가 2쪽을 가리켜도 2쪽은 따라 나가지 않는다', async () => {
    const doc = await PDFDocument.create()
    const p1 = doc.addPage([300, 300])
    const p2 = doc.addPage([300, 300])
    const ctx = doc.context
    p1.node.set(PDFName.of('Contents'), ctx.register(ctx.flateStream('BT (PAGE-ONE) Tj ET')))
    p2.node.set(PDFName.of('Contents'), ctx.register(ctx.flateStream('BT (SECRET-BUDGET-2) Tj ET')))
    const 링크 = ctx.obj({ Type: 'Annot', Subtype: 'Link', Rect: [0, 0, 10, 10], Dest: [p2.ref, 'XYZ', null, null, null] })
    p1.node.set(PDFName.of('Annots'), ctx.obj([ctx.register(링크)]))

    const r = await 훑기(await 첫쪽만(await doc.save()))
    expect(r.쪽딕셔너리).toBe(1)
    expect(r.있나('PAGE-ONE')).toBe(true)
    expect(r.있나('SECRET-BUDGET-2')).toBe(false)
  })

  it('상속 Resources의 XObject 중 1쪽이 그리지 않는 것은 따라 나가지 않는다', async () => {
    const doc = await PDFDocument.create()
    const p1 = doc.addPage([300, 300])
    const p2 = doc.addPage([300, 300])
    const ctx = doc.context
    const 폼 = (글자: string) =>
      ctx.register(ctx.flateStream(글자, { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 1, 1] }))
    // 쪽 트리 뿌리에 공용 Resources — 두 쪽 모두 이걸 물려받는다
    doc.catalog.Pages().set(PDFName.of('Resources'), ctx.obj({ XObject: { Im1: 폼('PAGE-ONE-XOBJ'), Im2: 폼('SECRET-SCAN-2') } }))
    p1.node.delete(PDFName.of('Resources'))
    p2.node.delete(PDFName.of('Resources'))
    p1.node.set(PDFName.of('Contents'), ctx.register(ctx.flateStream('q /Im1 Do Q')))
    p2.node.set(PDFName.of('Contents'), ctx.register(ctx.flateStream('q /Im2 Do Q')))

    const r = await 훑기(await 첫쪽만(await doc.save()))
    expect(r.있나('PAGE-ONE-XOBJ')).toBe(true)
    expect(r.있나('SECRET-SCAN-2')).toBe(false)
  })

  it('Contents가 배열이어도 각 스트림에서 쓰는 이름을 모은다', async () => {
    const doc = await PDFDocument.create()
    const p1 = doc.addPage([300, 300])
    const ctx = doc.context
    const 폼 = (글자: string) =>
      ctx.register(ctx.flateStream(글자, { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 1, 1] }))
    p1.node.set(PDFName.of('Resources'), ctx.obj({ XObject: { A: 폼('XOBJ-A'), B: 폼('XOBJ-B'), C: 폼('XOBJ-C') } }))
    p1.node.set(PDFName.of('Contents'), ctx.obj([ctx.register(ctx.flateStream('/A Do')), ctx.register(ctx.stream('q /B Do Q'))]))

    const r = await 훑기(await 첫쪽만(await doc.save()))
    expect(r.있나('XOBJ-A')).toBe(true)
    expect(r.있나('XOBJ-B')).toBe(true)
    expect(r.있나('XOBJ-C')).toBe(false)
  })

  it('1쪽 내용을 해독할 수 없으면 전부 보내지 않고 PdfError', async () => {
    const doc = await PDFDocument.create()
    const p1 = doc.addPage([300, 300])
    const ctx = doc.context
    const 이미지 = ctx.register(ctx.flateStream('SECRET', { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 1, 1] }))
    p1.node.set(PDFName.of('Resources'), ctx.obj({ XObject: { Im9: 이미지 } }))
    // 지원하지 않는 필터 → 어떤 XObject를 쓰는지 알 수 없다
    p1.node.set(PDFName.of('Contents'), ctx.register(ctx.stream('garbage', { Filter: 'JBIG2Decode' })))
    await expect(첫쪽만(await doc.save())).rejects.toBeInstanceOf(PdfError)
  })
})
