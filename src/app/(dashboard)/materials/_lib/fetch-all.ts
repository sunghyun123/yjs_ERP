// src/app/(dashboard)/materials/_lib/fetch-all.ts
// PostgREST는 요청당 최대 1000행 — 잔량 파생은 기록 '전체'가 필요해서
// 조용히 잘리면 재고 숫자가 틀린다. 1000행씩 끝까지 페이징한다.
const PAGE = 1000

export async function fetchAll<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1)
    if (error) throw new Error(`자재 데이터 조회 실패: ${error.message}`)
    const rows = data ?? []
    all.push(...rows)
    if (rows.length < PAGE) return all
  }
}
