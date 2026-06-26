/**
 * 백업 파일명 목록을 보관(keep) / 삭제(delete)로 분류하는 순수 함수.
 * 로컬 디스크와 Supabase Storage 양쪽에 동일하게 적용한다.
 *
 * 파일명 규칙: YYYY-MM-DD-HHMMSS-db.sql.gz
 * 규칙: 최근 dailyDays일 내 전부 보관 → 그보다 오래된 것 중 일요일자 최신
 *       weeklyCount개 보관 → 나머지 삭제. 파싱 불가 파일은 절대 삭제하지 않는다.
 */
export type RetentionPolicy = { dailyDays: number; weeklyCount: number }
export type RetentionResult = { keep: string[]; delete: string[] }

const FILE_RE = /^(\d{4})-(\d{2})-(\d{2})-(\d{6})-db\.sql\.gz$/

function parseDate(name: string): Date | null {
  const m = FILE_RE.exec(name)
  if (!m) return null
  const [, y, mo, d] = m
  const yr = Number(y)
  const month = Number(mo) - 1
  const day = Number(d)
  const date = new Date(yr, month, day)
  // 달력상 유효하지 않은 날짜(예: 13월, 32일)는 오버플로되므로 파싱 불가로 처리
  if (date.getFullYear() !== yr || date.getMonth() !== month || date.getDate() !== day) {
    return null
  }
  return date
}

function dayDiff(now: Date, then: Date): number {
  const MS = 86_400_000
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const b = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()
  return Math.round((a - b) / MS)
}

export function selectForRetention(
  fileNames: string[],
  now: Date,
  policy: RetentionPolicy,
): RetentionResult {
  const keep: string[] = []
  const del: string[] = []
  const weeklyCandidates: { name: string; date: Date }[] = []

  for (const name of fileNames) {
    const date = parseDate(name)
    if (!date) {
      keep.push(name) // 알 수 없는 파일은 보존
      continue
    }
    const diff = dayDiff(now, date)
    if (diff < policy.dailyDays) {
      keep.push(name) // 최근 N일(미래 날짜 포함) 일별 전부 보관
    } else if (date.getDay() === 0) {
      weeklyCandidates.push({ name, date }) // 일요일자만 주간 후보
    } else {
      del.push(name)
    }
  }

  weeklyCandidates.sort((a, b) => b.date.getTime() - a.date.getTime())
  weeklyCandidates.forEach((c, i) => {
    if (i < policy.weeklyCount) keep.push(c.name)
    else del.push(c.name)
  })

  return { keep, delete: del }
}
