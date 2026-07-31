// 수주대장 조회 필터 — 렌더와 분리한 순수 함수. 조건이 5개라 인라인으로 두면
// 눈으로 검증이 안 되고, 축이 늘 때마다 조용히 어긋난다.
// 연도·상태·유형 판정은 도넛과 공유하는 정본(../../_lib/수주분류)을 호출만 한다.

import {
  공사구분정규화,
  공사상태,
  연도목록,
  연도미상,
  연도추출,
  type 상태,
  type 연도,
  type 연도선택,
} from '../../_lib/수주분류'
import type { 수주행 } from '../_types'

export type 상태선택 = '전체' | '진행전' | '진행중' | '준공완료'
export type 원청사선택 = '전체' | '없음' | number
export type 공사구분선택 = '전체' | '총가' | '단가' | '민수'

export type 수주필터조건 = {
  연도: 연도선택
  상태: 상태선택
  원청사: 원청사선택
  공사구분: 공사구분선택
  검색어: string
}

export const 초기필터: 수주필터조건 = {
  연도: '전체', // 수주대장은 '대장 전체'를 보는 화면 — 올해로 시작하면 열자마자 대부분이 사라진 것처럼 보인다
  상태: '전체',
  원청사: '전체',
  공사구분: '전체',
  검색어: '',
}

export const 상태옵션: 상태선택[] = ['전체', '진행전', '진행중', '준공완료']
export const 공사구분옵션: 공사구분선택[] = ['전체', '총가', '단가', '민수']

// 화면 라벨 → 판정 함수 반환값. 도넛은 '미진행'이라 쓰고 수주대장은 '진행전'이라 부른다 —
// 판정은 한 곳(공사상태), 표기만 화면마다 다르다. 이 표가 그 대응의 유일한 정본이다.
const 상태매핑: Record<Exclude<상태선택, '전체'>, 상태> = {
  진행전: '미진행',
  진행중: '진행중',
  준공완료: '완료',
}

export function 수주연도(row: 수주행): 연도 {
  return 연도추출(row.지중no) ?? 연도미상
}

export function 수주필터(rows: 수주행[], 조건: 수주필터조건): 수주행[] {
  const q = 조건.검색어.trim().toLowerCase()
  return rows.filter((row) => {
    if (조건.연도 !== '전체' && 수주연도(row) !== 조건.연도) return false
    if (조건.상태 !== '전체' && 공사상태(row.준공여부, row.이력건수) !== 상태매핑[조건.상태]) return false
    if (조건.원청사 === '없음') {
      if (row.원청사_id != null) return false
    } else if (조건.원청사 !== '전체' && row.원청사_id !== 조건.원청사) {
      return false
    }
    if (조건.공사구분 !== '전체' && 공사구분정규화(row.공사구분) !== 조건.공사구분) return false
    if (q && !row.공사명.toLowerCase().includes(q) && !row.지중no.toLowerCase().includes(q)) return false
    return true
  })
}

// 드롭다운 옵션은 전체 data에서 파생시킨다(필터 결과가 아니라) — 필터를 걸수록
// 선택지가 사라져 되돌릴 수 없게 되는 걸 막는다.
// 건수는 붙이지 않는다: 원청사 편중이 심해(한 곳이 426건, 나머지 대부분 1건) 숫자가 잡음이 된다.
export function 원청사목록(rows: 수주행[]): { id: number; 거래처명: string }[] {
  const m = new Map<number, string>()
  for (const r of rows) {
    if (r.원청사_id == null) continue
    // 이름을 못 받은 경우에도 선택지를 잃지 않게 id를 표시값으로 쓴다
    m.set(r.원청사_id, r.원청사?.거래처명 ?? `#${r.원청사_id}`)
  }
  return [...m]
    .map(([id, 거래처명]) => ({ id, 거래처명 }))
    .sort((a, b) => a.거래처명.localeCompare(b.거래처명, 'ko'))
}

export function 원청사없음존재(rows: 수주행[]): boolean {
  return rows.some((r) => r.원청사_id == null)
}

export function 연도선택목록(rows: 수주행[]): 연도선택[] {
  return ['전체', ...연도목록(rows.map((r) => ({ 연도: 수주연도(r) })))]
}

// 검색형 선택 컴포넌트는 값을 숫자 id 하나로만 다룬다(null = 미선택 = 전체).
// '원청사 없음'을 같은 통로로 태우려고, 실제 거래처 id에 없는 음수 하나를 자리표로 쓴다.
export const 원청사없음ID = -1

export function 원청사값(id: number | null): 원청사선택 {
  if (id === null) return '전체'
  return id === 원청사없음ID ? '없음' : id
}

export function 원청사ID(선택: 원청사선택): number | null {
  if (선택 === '전체') return null
  return 선택 === '없음' ? 원청사없음ID : 선택
}

// 푸터에 "/ 전체 N건"을 띄울지 판단 — 축 하나라도 움직였을 때만.
export function 필터적용중(조건: 수주필터조건): boolean {
  return (
    조건.연도 !== '전체' ||
    조건.상태 !== '전체' ||
    조건.원청사 !== '전체' ||
    조건.공사구분 !== '전체' ||
    조건.검색어.trim() !== ''
  )
}
