import { z } from 'zod'

// AI와 주고받는 키는 영문(구조화 출력의 name은 ASCII만 받고, 한글 스키마 키는 문서상 보장이 없다).
// 우리 코드 안에서는 toKorean()으로 한 번 옮긴 한글 타입만 쓴다.
const 문자 = z.string().nullable()
// 금액은 정수 검사를 하지 않는다 — 형식이 이상하면 카드에서 검산 경고로 드러내는 편이 502보다 낫다
const 금액 = z.number().nullable()

export const 추출WireSchema = z.object({
  project_no: 문자,
  project_name: 문자,
  notice_date: 문자, // YYYY-MM-DD 기대. 형식이 틀리면 카드에서 '확인 필요'
  office_name: 문자,
  contract_amount: 금액,
  supply_amount: 금액,
  vat_amount: 금액,
  overview: 문자,
  period_start: 문자,
  period_end: 문자,
  work_draft: z.array(z.string()),
})

const 문자칸 = { type: ['string', 'null'] } as const
const 금액칸 = { type: ['number', 'null'] } as const

/** OpenAI text.format 에 넣는 JSON schema. strict 모드라 모든 칸 required + additionalProperties false. */
export const 추출JSONSchema = {
  type: 'object',
  properties: {
    project_no: { ...문자칸, description: '공사번호 원문 그대로 (예: 3917-2025-3862 (01))' },
    project_name: { ...문자칸, description: '공사명 원문 그대로' },
    notice_date: { ...문자칸, description: '시공통보일자, YYYY-MM-DD' },
    office_name: { ...문자칸, description: '사업소명' },
    contract_amount: { ...금액칸, description: '계약금액(부가세 포함), 원 단위 정수, 쉼표 없이' },
    supply_amount: { ...금액칸, description: '공급가액, 원 단위 정수' },
    vat_amount: { ...금액칸, description: '부가가치세, 원 단위 정수' },
    overview: { ...문자칸, description: '공사개요' },
    period_start: { ...문자칸, description: '공사기간 시작, YYYY-MM-DD' },
    period_end: { ...문자칸, description: '공사기간 끝, YYYY-MM-DD' },
    work_draft: {
      type: 'array',
      items: { type: 'string' },
      description: '공사시행 초안 1~5줄. 공사개요에 적힌 작업만, 한 줄에 한 작업, 짧은 명사형(예: 지상개폐기 3회로 1기 신설). 장소·사람 이름·업체명·날짜는 쓰지 않는다',
    },
  },
  required: [
    'project_no', 'project_name', 'notice_date', 'office_name', 'contract_amount',
    'supply_amount', 'vat_amount', 'overview', 'period_start', 'period_end', 'work_draft',
  ],
  additionalProperties: false,
} as const

export const 추출지시 = [
  '너는 한국전력 시공통보서 1쪽(스캔 이미지)에서 값을 읽는 도구다.',
  '문서에 적힌 값만 옮긴다. 읽지 못하거나 문서에 없는 칸은 지어내지 말고 null로 둔다.',
  '금액은 원 단위 정수로, 쉼표·"원"을 빼고 적는다.',
  '날짜는 YYYY-MM-DD로 적는다.',
  // 초안 규칙 (2026-11-05 실측 후 강화): 설명문·다른 주소를 공사 장소로 착각·현장 책임자 이름이 카드에 들어간 사례가 있었다.
  // 카드는 씽크와이즈로 붙여 넣어 남으므로 사람 이름(개인정보)과 근거 없는 장소가 들어가면 안 된다.
  'work_draft만 예외로 초안을 쓴다. 규칙:',
  '- 공사개요 칸에 적힌 작업만 옮긴다. 공사개요에 없는 작업을 추측해 넣지 않는다.',
  '- 한 줄에 한 작업, 짧은 명사형으로 쓴다 (예: "지상개폐기 3회로 1기 신설", "저압 케이블 포설"). 문장(~한다, ~합니다)으로 쓰지 않는다.',
  '- 장소·주소, 사람 이름, 업체명, 날짜, 공사기간은 쓰지 않는다 (다른 칸에 이미 있다).',
  '- 1~5줄. 공사개요가 비었거나 읽지 못했으면 빈 배열로 둔다.',
].join('\n')

export type 추출WireResult = z.infer<typeof 추출WireSchema>

export type 추출결과 = {
  공사번호: string | null
  공사명: string | null
  시공통보일자: string | null
  사업소명: string | null
  계약금액: number | null
  공급가액: number | null
  부가가치세: number | null
  공사개요: string | null
  공사기간_시작: string | null
  공사기간_끝: string | null
  공사시행초안: string[]
}

export function toKorean(w: 추출WireResult): 추출결과 {
  return {
    공사번호: w.project_no,
    공사명: w.project_name,
    시공통보일자: w.notice_date,
    사업소명: w.office_name,
    계약금액: w.contract_amount,
    공급가액: w.supply_amount,
    부가가치세: w.vat_amount,
    공사개요: w.overview,
    공사기간_시작: w.period_start,
    공사기간_끝: w.period_end,
    공사시행초안: w.work_draft.slice(0, 8), // 선택 사항인 초안이 길다고 응답 전체를 실패시키지 않는다
  }
}

/**
 * 판정의 '존재' 검사: 핵심 칸이 하나도 없으면 AI가 문서를 읽은 게 아니다.
 * 이걸 통과시키면 '확인 필요'로 가득 찬 빈 카드가 성공처럼 보인다 → 실패로 돌린다.
 * 일부만 비면 통과(판정의 '내용'은 관대하게) — 카드에 '확인 필요'와 경고로 드러난다.
 */
export function 읽지못함(e: 추출결과): boolean {
  const 핵심 = [e.공사번호, e.공사명, e.시공통보일자, e.계약금액, e.공급가액]
  return 핵심.every(v => v == null || v === '')
}
