'use client'

import { useState, useEffect } from 'react'
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
  const [display, setDisplay] = useState(value != null ? value.toLocaleString('ko-KR') : '')
  useEffect(() => {
    setDisplay(value != null ? value.toLocaleString('ko-KR') : '')
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    if (raw === '') { setDisplay(''); onChange(null) }
    else {
      const num = parseInt(raw, 10)
      setDisplay(num.toLocaleString('ko-KR'))
      onChange(num)
    }
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
  // display 는 사용자가 입력한 "누적 달성률 %" 문자열. value(정본)는 이번 증분(원)이라
  // 의미가 달라(누적 vs 증분) 둘을 분리해 타이핑 중 반올림 떨림을 막는다.
  const [display, setDisplay] = useState('')

  useEffect(() => {
    if (value == null) { setDisplay(''); return }
    // 현재 display(누적%)가 이미 value(증분원)을 나타내면 덮어쓰지 않는다 (타이핑 떨림 방지).
    const implied = display === '' || display === '.' ? null : 누적목표를증분으로(parseFloat(display), base, 직전누계)
    if (implied === value) return
    // value는 증분 → 화면에는 누적%로 환원: (직전누계 + 증분) / base.
    const pct = wonToPercent(직전누계 + value, base)
    setDisplay(pct == null ? '' : String(Math.round(pct * 100) / 100))
  }, [value, base, 직전누계]) // eslint-disable-line react-hooks/exhaustive-deps

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

export function 성과Input({
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
