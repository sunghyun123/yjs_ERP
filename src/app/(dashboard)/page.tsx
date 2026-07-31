import { Suspense } from 'react'
import { KpiCards, KpiCardsSkeleton } from './_components/KpiCards'
import { ProfitChartSection, ProfitChartSkeleton } from './_components/ProfitChartSection'
import { UnregisteredProjects, UnregisteredProjectsSkeleton } from './_components/UnregisteredProjects'
import { TypeStatusDonutSection, TypeStatusDonutSkeleton } from './_components/TypeStatusDonutSection'
import { createClient } from '@/lib/supabase/server'
import { load성과재료 } from './_lib/junggong-seonggwa'

export default function DashboardPage() {
  const 성과재료Promise = createClient().then(load성과재료)

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: '#0f172a' }}>
          대시보드
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
          영전사 ERP 현황
        </p>
      </div>

      <Suspense fallback={<KpiCardsSkeleton />}>
        <KpiCards 성과재료Promise={성과재료Promise} />
      </Suspense>

      <Suspense fallback={<ProfitChartSkeleton />}>
        <ProfitChartSection 성과재료Promise={성과재료Promise} />
      </Suspense>

      <Suspense fallback={<TypeStatusDonutSkeleton />}>
        <TypeStatusDonutSection />
      </Suspense>

      <Suspense fallback={<UnregisteredProjectsSkeleton />}>
        <UnregisteredProjects />
      </Suspense>
    </div>
  )
}
