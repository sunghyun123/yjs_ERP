'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { wonToPercent, 누적목표를증분으로 } from '../_lib/percent'

export function MoneyInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  className?: string
}) {
  // display는 value의 파생(항상 계산 가능) — state+effect 동기화가 만들던 틀린 프레임·낭비 렌더 제거.
  // 진실의 원천은 부모 value 하나: 입력 → onChange → 부모 갱신 → 다음 렌더에 포맷되어 표시 (OrderForm MoneyInput과 동일 처방)
  const display = value != null ? value.toLocaleString('ko-KR') : ''

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    onChange(raw === '' ? null : parseInt(raw, 10))
  }

  return (
    <Input
      value={display}
      onChange={handleChange}
      placeholder={placeholder ?? '0'}
      inputMode="numeric"
      className={className}
    />
  )
}

// value(증분원)를 화면용 누적% 문자열로 환원: (직전누계+증분)/base, 소수 둘째 자리 반올림.
const 누적표시 = (증분: number, base: number, 직전누계: number) => {
  const pct = wonToPercent(직전누계 + 증분, base)
  return pct == null ? '' : String(Math.round(pct * 100) / 100)
}

function PercentInput({
  value,
  onChange,
  base,
  직전누계,
  className,
}: {
  value: number | null
  onChange: (v: number | null) => void
  base: number // 환산 가능할 때만 렌더되므로 호출부에서 > 0 보장
  직전누계: number // 기준일 직전까지의 누계 성과금액(원). %는 "누적 목표"라 증분 역산의 기준점이 된다.
  className?: string
}) {
  // display는 사용자가 입력 중인 "누적 달성률 %" 문자열 — 완전 파생 불가라 state(원본 초안)가 맞다:
  // 여러 %가 같은 증분(원)으로 반올림돼 역산이 유일하지 않고, "12." 같은 입력 중 문자열도 지켜야 한다.
  const [display, setDisplay] = useState(() => (value == null ? '' : 누적표시(value, base, 직전누계)))

  // 부모가 value·환산 기준을 바꿨을 때만 display를 따라 맞춘다 — effect 대신 prev 비교 렌더 중 조정(②형).
  const [prev, setPrev] = useState({ value, base, 직전누계 })
  if (value !== prev.value || base !== prev.base || 직전누계 !== prev.직전누계) {
    setPrev({ value, base, 직전누계 })
    if (value == null) setDisplay('')
    else {
      // 현재 display(누적%)가 이미 value(증분원)을 나타내면 덮어쓰지 않는다 (타이핑 떨림 방지).
      const implied = display === '' || display === '.' ? null : 누적목표를증분으로(parseFloat(display), base, 직전누계)
      if (implied !== value) setDisplay(누적표시(value, base, 직전누계))
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 숫자와 소수점 1개만 허용
    const raw = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
    setDisplay(raw)
    if (raw === '' || raw === '.') { onChange(null); return }
    // 입력은 "누적 목표"이므로 저장 정본(증분) = 누적목표 − 직전누계. (음수=하향 정정도 그대로 허용)
    onChange(누적목표를증분으로(parseFloat(raw), base, 직전누계))
  }

  return (
    <div className="relative">
      <Input
        value={display}
        onChange={handleChange}
        placeholder="0"
        inputMode="decimal"
        className={cn('pr-7', className)}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">%</span>
    </div>
  )
}

// 성과 입력 (컴포넌트 함수명은 ASCII 대문자 시작 — react-hooks 린트가 훅 검사를 하는 조건)
export function PerformanceInput({
  value,
  onChange,
  하도적용금액,
  직전누계,
}: {
  value: number | null
  onChange: (v: number | null) => void
  하도적용금액: number | null
  직전누계: number
}) {
  const 환산가능 = 하도적용금액 != null && 하도적용금액 > 0
  const [모드, set모드] = useState<'원' | '%'>('%')
  // 환산 불가(공사단가 정보 없음)면 % 입력 불가 → 원 모드 강제.
  const effective모드 = 환산가능 ? 모드 : '원'

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        {/* %는 "이 작업일자까지 누적 달성률", 원은 "이번 증분" — 모드마다 입력 의미가 달라 라벨도 분기한다.
            % 라벨에 "이 작업일자까지"를 명시해 우측 "저장 후 전체 누계"와 혼동을 막는다. */}
        <Label className="text-xs text-gray-600">
          {effective모드 === '%' ? '성과 (이 작업일자까지 누적)' : '성과 (이번 증분)'}
        </Label>
        <div className="inline-flex rounded-md border border-gray-200 overflow-hidden text-xs">
          {(['원', '%'] as const).map((m) => {
            const disabled = m === '%' && !환산가능
            return (
              <button
                key={m}
                type="button"
                disabled={disabled}
                onClick={() => set모드(m)}
                title={disabled ? '공사단가 정보가 없어 % 입력 불가' : undefined}
                className={cn(
                  'px-2.5 py-1 transition-colors',
                  effective모드 === m ? 'bg-[#1e2d5a] text-white' : 'bg-white text-gray-500 hover:bg-gray-50',
                  disabled && 'opacity-40 cursor-not-allowed hover:bg-white',
                )}
              >
                {m}
              </button>
            )
          })}
        </div>
      </div>
      {effective모드 === '%' ? (
        <PercentInput value={value} onChange={onChange} base={하도적용금액 as number} 직전누계={직전누계} className="h-10 text-sm" />
      ) : (
        <MoneyInput value={value} onChange={onChange} className="h-10 text-sm" placeholder="0" />
      )}
      {!환산가능 && (
        <p className="text-[10px] text-gray-400 mt-1">공사단가 정보가 없어 % 입력은 사용할 수 없습니다.</p>
      )}
      {환산가능 && effective모드 === '%' && (
        <p className="text-[10px] text-gray-400 mt-1">이번 작업 후 <b>이 작업일자까지의 누적</b> 달성률을 입력하세요. 증분 금액은 자동 계산됩니다.</p>
      )}
    </div>
  )
}
