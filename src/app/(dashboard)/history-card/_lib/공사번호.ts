import type { 수주Row } from '@/types/database'

/** 카드 생성에 필요한 수주 칸만. route가 이 칸들만 select 한다. */
export type 수주후보 = Pick<
  수주Row,
  'id' | '지중no' | '공사명' | '공사번호' | '원청사_id' | '수주금액_공급가' | '보험료율' | '하도전용율'
>

/**
 * 비교용 키: 괄호 꼬리(차수 "(01)")를 지우고 숫자만 남긴다.
 * ERP에는 대시 없이 저장된 행이 있고(391720253862), 차수 꼬리를 저장한 행은 없다(2026-11-05 실측).
 */
export function 공사번호키(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\([^)]*\)/g, '').replace(/\D/g, '')
  return digits.length > 0 ? digits : null
}

// 한전 공사번호는 12자리(NNNN-YYYY-NNNN). CG의 '26-100'처럼 짧은 내부 번호와 우연히 겹치지 않게 한다.
const 최소키길이 = 10

/** 같은 키의 수주를 전부 돌려준다. 2건 이상이면 고르는 건 호출한 쪽의 몫(첫 행을 조용히 고르지 않는다). */
export function find기존수주(통보서공사번호: string | null, 수주목록: 수주후보[]): 수주후보[] {
  const key = 공사번호키(통보서공사번호)
  if (key === null || key.length < 최소키길이) return []
  return 수주목록.filter(r => 공사번호키(r.공사번호) === key)
}
