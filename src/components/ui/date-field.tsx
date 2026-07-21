'use client'

import * as React from 'react'

import { Input } from '@/components/ui/input'

/**
 * 공용 날짜 입력. 키보드로 6월 31일 같은 무효 날짜를 치면 브라우저가 값을 소독해
 * `e.target.value`가 ""가 되는데(화면엔 무효 텍스트가 남음), 그 어긋남을 사용자에게
 * 알리고 표시=값을 다시 맞춘다. RHF register 사용처와 controlled 사용처를 모두 지원.
 */
type DateFieldProps = Omit<React.ComponentProps<'input'>, 'type'> & {
  // 에러 문구를 감싸기 위한 wrapper용. 인라인 레이아웃(날짜 범위 필터 등)에서 조정.
  wrapperClassName?: string
}

export function DateField({
  ref,
  className,
  wrapperClassName,
  onBlur,
  onChange,
  ...props
}: DateFieldProps) {
  // validity.badInput 검사와 강제 초기화를 위해 DOM 노드 핸들이 필요.
  const innerRef = React.useRef<HTMLInputElement>(null)
  const [invalid, setInvalid] = React.useState(false)

  // register가 넘긴 ref(RHF가 값 읽기·reset에 쓰는 핸들)를 삼키지 않고 innerRef와 함께 유지.
  const setRefs = (node: HTMLInputElement | null) => {
    innerRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) (ref as React.RefObject<HTMLInputElement | null>).current = node
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // badInput = 브라우저가 무효 날짜(6/31 등) 파싱에 실패한 상태. 이때 value는 이미 "".
    if (e.currentTarget.validity.badInput) {
      setInvalid(true)
      // 화면에 남은 무효 텍스트를 비운다. uncontrolled면 빈 값으로, controlled면
      // 리렌더 시 value prop(직전 유효값)으로 스냅백돼 어느 쪽이든 표시=진실이 일치.
      e.currentTarget.value = ''
    } else {
      setInvalid(false)
    }
    onBlur?.(e)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 무효였다가 유효한 날짜가 들어오면 즉시 에러 해제(다음 blur까지 기다리지 않음).
    if (invalid && !e.currentTarget.validity.badInput) setInvalid(false)
    onChange?.(e)
  }

  return (
    <div className={wrapperClassName}>
      <Input
        ref={setRefs}
        type="date"
        aria-invalid={invalid || undefined}
        onBlur={handleBlur}
        onChange={handleChange}
        className={className}
        {...props}
      />
      {invalid && (
        <p className="mt-1 text-xs text-destructive">존재하지 않는 날짜입니다</p>
      )}
    </div>
  )
}
