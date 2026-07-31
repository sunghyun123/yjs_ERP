/**
 * PostgREST 1000행 캡 우회 — 페이지 단위로 끝까지 긁어온다.
 *
 * 캡에 걸리면 에러가 아니라 200 OK + 1000행이 온다. 표도 그려지고 합계도 멀쩡한 숫자를
 * 찍는다 — 그 숫자만 조용히 모자랄 뿐이다. 매출손익은 그 합계로 판단을 내리는 화면이라
 * 조용히 잘리는 쪽보다 다 가져오거나(정상) 시끄럽게 죽는 쪽(상한 초과)을 택한다.
 *
 * ⚠️ 넘기는 쿼리에 반드시 정렬(.order)을 걸 것. PostgREST는 ORDER BY 없이 페이지를 나누면
 *    페이지 사이 순서를 보장하지 않아 행이 중복되거나 빠질 수 있다.
 */

type RangeResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

const PAGE_SIZE = 1000
/** 이 화면이 한 번에 다룰 수 있는 상한. 넘으면 집계를 DB로 내리는 설계 변경이 필요하다. */
const MAX_PAGES = 50

export async function fetchAllRows<T>(
  label: string,
  page: (from: number, to: number) => RangeResult<T>,
): Promise<T[]> {
  const out: T[] = []
  for (let p = 0; p < MAX_PAGES; p++) {
    const from = p * PAGE_SIZE
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`${label} 조회 실패: ${error.message}`)
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < PAGE_SIZE) return out
  }
  throw new Error(
    `${label}이(가) ${MAX_PAGES * PAGE_SIZE}행을 넘었습니다. 잘린 합계를 정상처럼 보여주지 않으려고 중단합니다.`,
  )
}
