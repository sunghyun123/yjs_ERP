import { NextResponse, type NextRequest } from 'next/server'
import { getDashboardAccess } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { 추출WireSchema, toKorean, 읽지못함 } from '@/app/(dashboard)/history-card/_lib/extract'
import { build카드 } from '@/app/(dashboard)/history-card/_lib/card'
import type { 수주후보 } from '@/app/(dashboard)/history-card/_lib/공사번호'
import { isPdf, 첫쪽만, PdfError, PDF_최대바이트 } from './pdf'
import { 통보서읽기, UpstreamError } from './openai'

export const runtime = 'nodejs' // pdf-lib·Buffer

// 한국어 컬럼명 select는 postgrest-js 타입 파서가 못 읽어 unknown 경유 캐스트(레포 관례, mcp/constructions 참고).
// 아래 모양이 맞다는 보장은 각 select 문자열뿐이다.
type 규칙행 = { id: number; 머리글자: string; 거래처_id: number | null; 사용: boolean }
type 요율행 = { 보험료제외율: number | null; 하도전용율: number | null }
type 조회결과<T> = { data: T | null; error: { code?: string; message: string } | null }

const 실패 = (status: number, message: string) => NextResponse.json({ error: message }, { status })

export async function POST(req: NextRequest) {
  // ① 문지기: 이 라우트는 OpenAI 요금을 쓴다. 로그인 + 화이트리스트만 부른다.
  //    service_role(Bearer) 라우트와 섞지 않는다 — 여기서 쓰는 DB 클라이언트는 세션+RLS다.
  const access = await getDashboardAccess()
  if (!access.authenticated) return 실패(401, '로그인이 필요합니다.')
  if (!access.entry) return 실패(403, '허용된 사용자가 아닙니다.')

  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_MODEL
  if (!apiKey || !model) {
    console.error('[history-card] env_missing')
    return 실패(500, '서버 설정이 빠졌습니다. 관리자에게 알려 주세요.')
  }

  // ② 입력 검사 (400 = 요청한 쪽이 고칠 수 있는 것)
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return 실패(400, '요청 형식이 잘못됐습니다.')
  }
  const 규칙Id = Number(form.get('prefixId'))
  const file = form.get('file')
  if (!Number.isInteger(규칙Id) || 규칙Id <= 0) return 실패(400, '머리글자를 고르세요.')
  if (!(file instanceof File)) return 실패(400, 'PDF 파일을 올려 주세요.')
  if (file.size > PDF_최대바이트) return 실패(400, 'PDF가 9MB를 넘습니다.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!isPdf(bytes)) return 실패(400, 'PDF 파일이 아닙니다.')

  // ③ 1쪽만 — 밖으로 나가는 것을 서버가 정한다
  let 첫쪽: Uint8Array
  try {
    첫쪽 = await 첫쪽만(bytes)
  } catch (e) {
    if (e instanceof PdfError) return 실패(400, e.message)
    throw e
  }

  const supabase = await createClient()

  // 규칙은 AI 호출 '전에' 읽는다 — 잘못된 요청에 요금을 쓰지 않는다
  const { data: 규칙, error: 규칙Err } = (await supabase
    .from('이력카드_머리글자')
    .select('id, 머리글자, 거래처_id, 사용')
    .eq('id', 규칙Id)
    .maybeSingle()) as unknown as 조회결과<규칙행>
  if (규칙Err) {
    console.error('[history-card] rule_query', 규칙Err.code)
    return 실패(500, '머리글자 규칙을 읽지 못했습니다.')
  }
  if (!규칙 || !규칙.사용) return 실패(400, '사용 중인 머리글자가 아닙니다.')

  // ④ AI (502 = 우리 서버는 멀쩡하고 상류가 실패)
  let raw: unknown
  try {
    raw = await 통보서읽기(첫쪽, { apiKey, model })
  } catch (e) {
    if (e instanceof UpstreamError) {
      console.error('[history-card]', e.단계) // 단계명만. 응답 원문·PDF 내용은 찍지 않는다
      return 실패(502, 'AI가 통보서를 읽지 못했습니다. 잠시 뒤 다시 시도하세요.')
    }
    throw e
  }
  // ⑤ 스키마 검증
  const parsed = 추출WireSchema.safeParse(raw)
  if (!parsed.success) {
    console.error('[history-card] openai_schema')
    return 실패(502, 'AI 응답 형식이 올바르지 않습니다.')
  }
  const 추출 = toKorean(parsed.data)
  // 빈 카드를 성공처럼 보여 주지 않는다
  if (읽지못함(추출)) return 실패(422, '통보서에서 값을 읽지 못했습니다. 시공통보서가 맞는지 확인하세요.')

  // ⑦ ERP 읽기 (쓰기 없음)
  let 수주목록: 수주후보[]
  try {
    수주목록 = await fetchAllRows<수주후보>('수주', (from, to) =>
      supabase
        .from('수주')
        .select('id, 지중no, 공사명, 공사번호, 원청사_id, 수주금액_공급가, 보험료율, 하도전용율')
        .order('id')
        .range(from, to) as unknown as PromiseLike<조회결과<수주후보[]>>,
    )
  } catch {
    console.error('[history-card] orders_query')
    return 실패(500, '수주 목록을 읽지 못했습니다.')
  }
  // RLS는 권한이 없을 때 에러가 아니라 200 + 빈 배열을 준다. 그대로 가면 '기존 수주 없음' + 번호 001이
  // 조용히 제안된다. 수주가 0건인 ERP는 실제로 없으니 빈 목록은 실패로 본다.
  if (수주목록.length === 0) {
    console.error('[history-card] orders_empty')
    return 실패(500, '수주 목록이 비어 있습니다. 관리자에게 알려 주세요.')
  }

  let 거래처요율: 요율행 | null = null
  if (규칙.거래처_id != null) {
    const { data: 거래처, error } = (await supabase
      .from('거래처')
      .select('보험료제외율, 하도전용율')
      .eq('id', 규칙.거래처_id)
      .maybeSingle()) as unknown as 조회결과<요율행>
    if (error) {
      console.error('[history-card] client_query', error.code)
      return 실패(500, '거래처 요율을 읽지 못했습니다.')
    }
    거래처요율 = 거래처
  }

  // ⑧ 조립 (저장 없음)
  return NextResponse.json(build카드({ 추출, 규칙, 거래처요율, 수주목록 }))
}
