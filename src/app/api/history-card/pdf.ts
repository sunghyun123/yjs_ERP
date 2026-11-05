import { PDFDocument } from 'pdf-lib'

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
  const out = await PDFDocument.create()
  const [page] = await out.copyPages(src, [0])
  out.addPage(page)
  return out.save()
}
