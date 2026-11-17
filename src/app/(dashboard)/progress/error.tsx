'use client'
// 공사이력 페이지 에러 경계. 미입력 탭은 조회가 실패하거나 수주가 0행이면 일부러 throw한다
// (빈 목록을 '다 입력함'처럼 보여주지 않으려고). 경계가 없으면 global-error까지 올라가 사이드바까지
// 사라지므로, 여기서 본문만 에러로 바꾼다.
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="m-6 rounded-xl border border-red-200 bg-white p-8" role="alert">
      <h1 className="text-xl font-semibold">공사이력을 불러오지 못했습니다</h1>
      <p className="my-4 text-slate-600">잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.</p>
      <button className="rounded border px-4 py-2" onClick={reset}>다시 시도</button>
    </div>
  )
}
