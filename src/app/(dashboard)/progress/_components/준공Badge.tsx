// 준공 = 회계 축(실수령 확정)의 표식. 진행 축(공사이력·달성률)은 건드리지 않고 뱃지로만 알린다.
export function 준공Badge({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 align-middle ${className ?? ''}`}
    >
      준공
    </span>
  )
}
