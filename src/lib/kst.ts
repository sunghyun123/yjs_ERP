// src/lib/kst.ts
// 한국 시간(Asia/Seoul) 고정 날짜 헬퍼.
// new Date().toISOString()은 UTC로 변환돼 KST 자정 무렵 하루가 밀리는 버그가 있다.
// 브라우저/서버 로컬 타임존과 무관하게 항상 KST 기준 날짜를 반환한다.

const KST = 'Asia/Seoul'

// en-CA 로케일은 'YYYY-MM-DD' 형식을 보장한다.
const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: KST,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** 임의 시점을 KST 기준 'YYYY-MM-DD'로 반환 */
export function formatKST(d: Date): string {
  return dateFmt.format(d)
}

/** 현재 KST 기준 'YYYY-MM-DD' */
export function todayKST(): string {
  return formatKST(new Date())
}

/** 임의 시점의 KST 기준 연/월/일 (월·일은 1-based) */
export function partsKST(d: Date = new Date()): { year: number; month: number; day: number } {
  const [year, month, day] = formatKST(d).split('-').map(Number)
  return { year, month, day }
}
