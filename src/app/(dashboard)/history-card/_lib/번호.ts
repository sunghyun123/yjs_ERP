/**
 * 새 수주 번호 '제안'. 확정은 수주 등록 때다(동시에 두 사람이 같은 번호를 받을 수 있다 — 화면 문구로 알린다).
 * 연도는 시공통보일자에서 읽는다. 서버 시계를 읽지 않으니 KST/UTC 9시간 창이 생길 자리가 없다.
 * 머리글자는 DB check(^[A-Z]{2}$)를 통과한 값만 들어온다 → 정규식에 그대로 넣어도 안전.
 */
export function suggest지중no(머리글자: string, 통보일자: string, 기존지중no: string[]): string | null {
  const m = /^(\d{4})-\d{2}-\d{2}$/.exec(통보일자)
  if (!m) return null
  const yy = m[1].slice(2)
  const 패턴 = new RegExp(`^${머리글자}${yy}-(\\d+)$`)
  let 최대 = 0
  for (const no of 기존지중no) {
    const hit = 패턴.exec(no)
    if (hit) 최대 = Math.max(최대, parseInt(hit[1], 10)) // 정수 비교
  }
  return `${머리글자}${yy}-${String(최대 + 1).padStart(3, '0')}`
}
