import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
  type PDFPageLeaf,
} from 'pdf-lib'

/**
 * 9MB. proxy.ts가 모든 요청에 걸려 있고 Next 16 proxyClientMaxBodySize 기본값이 10MB라,
 * 그보다 큰 본문은 우리 코드에 닿기 전에 잘린다. 잘린 본문은 '깨진 PDF'로 보여 원인을 못 찾는다
 * → 10MB 아래에서 우리가 먼저 명확한 400을 낸다. (화면도 같은 값으로 미리 막는다)
 */
export const PDF_최대바이트 = 9 * 1024 * 1024

export class PdfError extends Error {}

/** 확장자·MIME은 보내는 쪽이 마음대로 적는다. 파일 첫 5바이트를 직접 본다. */
export function isPdf(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false
  return String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-'
}

/**
 * 1쪽 쪽 딕셔너리에 남겨도 되는 키. 이 밖의 키(/Annots, /B, /AA, /Thumb …)는 지운다.
 * pdf-lib의 copyPages는 참조를 끝까지 따라가 복사한다 — 1쪽 링크 주석의 /Dest가 2쪽을 가리키면
 * 2쪽 딕셔너리와 내용까지 같이 나간다. '지울 키 목록'이 아니라 '남길 키 목록'으로 둬서
 * 모르는 키는 기본적으로 안 나가게 한다(fail-closed).
 */
const 남길쪽키 = new Set([
  'Type', 'Parent', 'Resources', 'Contents',
  'MediaBox', 'CropBox', 'BleedBox', 'TrimBox', 'ArtBox', 'Rotate', 'UserUnit', 'Group',
])

/** 내용 스트림에서 `/이름 Do`로 실제 그리는 XObject 이름을 모은다. 해독 못 하면 던진다(호출한 쪽이 PdfError로). */
function 그리는XObject이름(page: PDFPageLeaf): Set<string> {
  const ctx = page.context
  const contents = page.Contents()
  const 스트림들 =
    contents === undefined ? [] : contents instanceof PDFArray ? contents.asArray().map(c => ctx.lookup(c)) : [contents]
  const 이름들 = new Set<string>()
  for (const st of 스트림들) {
    if (!(st instanceof PDFRawStream)) throw new PdfError('PDF 1쪽 내용을 읽을 수 없습니다.')
    const 글자 = Buffer.from(decodePDFRawStream(st).decode()).toString('latin1')
    // 문자열·주석 안의 'Do'를 잘못 세면 더 남길 뿐(이미지가 빠지지는 않는다) → 단순 정규식으로 충분
    for (const m of 글자.matchAll(/\/([^\s/<>\[\]()%{}]+)\s+Do(?![^\s/<>\[\]()%{}])/g)) 이름들.add(m[1])
  }
  return 이름들
}

/**
 * 원본 1쪽을 복사 전에 손질한다. 2~9쪽 내용이 참조를 타고 따라 나가는 길을 끊는다.
 * - 쪽 키는 남길쪽키만
 * - Resources는 상속분까지 합쳐 1쪽에 직접 새로 단다. /XObject는 1쪽 내용이 `Do`로 부르는 이름만 남긴다
 *   (쪽 트리 뿌리의 공용 Resources에 2쪽 스캔 이미지가 들어 있으면 그대로 따라 나가기 때문)
 * 한계: 걸러내는 건 1단계뿐이다. 남긴 Form XObject가 자기 Resources로 다른 XObject를 부르면 그건 통째로 나간다.
 *       /Font·/Pattern·/Shading 등 XObject가 아닌 자원은 걸러내지 않는다(글꼴은 내용이 아니고, 스캔 PDF엔 거의 없다).
 */
function 첫쪽손질(src: PDFDocument): void {
  const page = src.getPage(0).node
  const ctx = src.context
  for (const key of page.keys()) {
    if (!남길쪽키.has(key.decodeText())) page.delete(key)
  }

  const 원래 = page.Resources() // 자기 것 또는 부모에게서 물려받은 것
  const 새 = 원래 ? 원래.clone(ctx) : ctx.obj({})
  const xobj = 원래 ? ctx.lookupMaybe(원래.get(PDFName.of('XObject')), PDFDict) : undefined
  if (xobj) {
    const 쓰는이름 = 그리는XObject이름(page)
    const 남길 = ctx.obj({})
    for (const [이름, 값] of xobj.entries()) {
      if (쓰는이름.has(이름.asString().slice(1)) || 쓰는이름.has(이름.decodeText())) 남길.set(이름, 값)
    }
    새.set(PDFName.of('XObject'), 남길)
  }
  page.set(PDFName.of('Resources'), 새) // 1쪽에 직접 달면 복사기가 부모의 공용 Resources를 안 본다
}

/**
 * 1쪽만 새 PDF로 만든다. 무엇이 OpenAI로 나가는지 서버가 정한다 — 2~9쪽(예산서·명세서)은 안 나간다.
 * 암호 걸린 PDF는 load가 던진다 → PdfError(400).
 */
export async function 첫쪽만(bytes: Uint8Array): Promise<Uint8Array> {
  let src: PDFDocument
  let 쪽수: number
  try {
    src = await PDFDocument.load(bytes)
    // 손상된 PDF는 load가 통과하고 getPageCount에서 TypeError로 터지기도 한다 → 같은 try 안에서 센다
    쪽수 = src.getPageCount()
  } catch {
    throw new PdfError('PDF를 열 수 없습니다. 암호가 걸렸거나 손상된 파일입니다.')
  }
  if (쪽수 < 1) throw new PdfError('쪽이 없는 PDF입니다.')
  // 손질·복사·저장도 깨진 쪽 트리에서 던질 수 있다 → 날것의 throw(500) 대신 400.
  // 1쪽 내용을 해독 못 하면 '전부 보내기'가 아니라 실패로 닫는다.
  try {
    첫쪽손질(src)
    const out = await PDFDocument.create()
    const [page] = await out.copyPages(src, [0])
    out.addPage(page)
    return await out.save()
  } catch (e) {
    if (e instanceof PdfError) throw e
    throw new PdfError('PDF 1쪽을 처리할 수 없습니다. 손상된 파일일 수 있습니다.')
  }
}
