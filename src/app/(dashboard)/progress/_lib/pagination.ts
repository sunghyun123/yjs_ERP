// 클라이언트 측 페이지 분할. items는 호출부가 이미 원하는 순서로 정렬해서 넘긴다.
// page는 1-base. 범위를 벗어나면 [1, totalPages]로 보정해 항상 유효한 페이지를 반환한다.
// (목록 삭제로 항목이 줄어 현재 page가 떠도 빈 화면 대신 마지막 페이지를 보여주기 위함)
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): { pageItems: T[]; totalPages: number; page: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(Math.max(1, Math.trunc(page)), totalPages)
  const start = (safePage - 1) * pageSize
  return { pageItems: items.slice(start, start + pageSize), totalPages, page: safePage }
}
