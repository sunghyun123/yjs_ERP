import { Suspense } from 'react'
import { KpiCards, KpiCardsSkeleton } from './_components/KpiCards'
import { ProfitChartSection, ProfitChartSkeleton } from './_components/ProfitChartSection'
import { ActiveProjects, ActiveProjectsSkeleton } from './_components/ActiveProjects'

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: '#0f172a' }}>
          대시보드
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
          영전사 ERP 현황
        </p>
      </div>

      <Suspense fallback={<KpiCardsSkeleton />}>
        <KpiCards />
      </Suspense>

      <Suspense fallback={<ProfitChartSkeleton />}>
        <ProfitChartSection />
      </Suspense>

      <Suspense fallback={<ActiveProjectsSkeleton />}>
        <ActiveProjects />
      </Suspense>
    </div>
  )
}
