'use client'
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="m-6 rounded-xl border border-red-200 bg-white p-8" role="alert"><h1 className="text-xl font-semibold">전산 현황을 불러오지 못했습니다</h1><p className="my-4 text-slate-600">잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.</p><button className="rounded border px-4 py-2" onClick={reset}>다시 시도</button></div>
}
