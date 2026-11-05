import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
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
})
