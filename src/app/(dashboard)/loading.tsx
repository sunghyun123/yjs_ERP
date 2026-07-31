import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-6 max-w-screen-2xl mx-auto space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 rounded-lg bg-white p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-7 w-32" />
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-white p-5">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-5 h-64 w-full" />
      </div>
    </div>
  )
}
