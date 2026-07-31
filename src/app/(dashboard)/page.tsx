import { Suspense } from 'react'
import { KpiCards, KpiCardsSkeleton } from './_components/KpiCards'
import { ProfitChartSection, ProfitChartSkeleton } from './_components/ProfitChartSection'
import { UnregisteredProjects, UnregisteredProjectsSkeleton } from './_components/UnregisteredProjects'
import { TypeStatusDonutSection, TypeStatusDonutSkeleton } from './_components/TypeStatusDonutSection'
import { createClient } from '@/lib/supabase/server'
import { load성과재료 } from './_lib/junggong-seonggwa'
import {
  load미입력공사,
  load연간투입원가재료,
  load투입헤더,
} from './_lib/dashboard-data'

export default function DashboardPage() {
  const now = new Date()
  const supabasePromise = createClient()
  const 성과재료Promise = supabasePromise.then(load성과재료)
  const 투입원가재료Promise = supabasePromise.then((supabase) =>
    load연간투입원가재료(supabase, now),
  )
  const 투입헤더Promise = supabasePromise.then(load투입헤더)
  const 미입력공사Promise = supabasePromise.then(load미입력공사)

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
        <KpiCards
          성과재료Promise={성과재료Promise}
          투입원가재료Promise={투입원가재료Promise}
          now={now}
        />
      </Suspense>

      <Suspense fallback={<ProfitChartSkeleton />}>
        <ProfitChartSection
          성과재료Promise={성과재료Promise}
          투입원가재료Promise={투입원가재료Promise}
        />
      </Suspense>

      <Suspense fallback={<TypeStatusDonutSkeleton />}>
        <TypeStatusDonutSection 성과재료Promise={성과재료Promise} />
      </Suspense>

      <Suspense fallback={<UnregisteredProjectsSkeleton />}>
        <UnregisteredProjects
          성과재료Promise={성과재료Promise}
          투입헤더Promise={투입헤더Promise}
          미입력공사Promise={미입력공사Promise}
        />
      </Suspense>
    </div>
  )
}
