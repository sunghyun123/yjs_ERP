// src/app/(dashboard)/materials/_lib/derive.ts
// 잔량·상태·재고 합계·피드는 전부 여기서 파생한다 — DB에 저장하지 않는다(원본 = 드럼·기록).
import type { 자재_드럼Row, 자재_드럼기록Row, 자재_선종Row, 자재_품목Row, 자재_품목기록Row } from '@/types/database'

export type 드럼상태 = '재고' | '출고중' | '소진'

export interface Derived드럼 extends 자재_드럼Row {
  잔량: number
  상태: 드럼상태
  잔재: boolean // 쓰다 남아 돌아온 드럼
}

export function derive드럼(드럼들: 자재_드럼Row[], 기록들: 자재_드럼기록Row[]): Derived드럼[] {
  const byDrum = new Map<number, 자재_드럼기록Row[]>()
  for (const r of 기록들) {
    const list = byDrum.get(r.드럼_id)
    if (list) list.push(r)
    else byDrum.set(r.드럼_id, [r])
  }
  return 드럼들.map((d) => {
    const recs = byDrum.get(d.id) ?? []
    const 사용합 = recs.reduce((s, r) => s + (r.사용량 ?? 0), 0)
    const 잔량 = Math.max(0, d.초기길이 - 사용합)
    const 출고중 = recs.some((r) => r.사용량 === null)
    const 상태: 드럼상태 = 출고중 ? '출고중' : 잔량 === 0 ? '소진' : '재고'
    return { ...d, 잔량, 상태, 잔재: 상태 !== '소진' && 잔량 < d.초기길이 }
  })
}

export interface Derived품목 extends 자재_품목Row {
  수량: number
}

export function derive품목(품목들: 자재_품목Row[], 기록들: 자재_품목기록Row[]): Derived품목[] {
  const sums = new Map<number, number>()
  for (const r of 기록들) sums.set(r.품목_id, (sums.get(r.품목_id) ?? 0) + r.변화량)
  return 품목들.map((p) => ({ ...p, 수량: sums.get(p.id) ?? 0 }))
}

export interface 드럼칩 {
  key: string
  잔량: number
  개수: number
  제조표기: string | null
  잔재: boolean
  출고중: boolean
  드럼ids: number[]
}

/** 같은 (잔량, 제조표기, 상태) 드럼을 목업의 "450m ×3" 칩 하나로 묶는다. 소진은 제외. */
export function group칩(드럼들: Derived드럼[]): 드럼칩[] {
  const map = new Map<string, 드럼칩>()
  for (const d of 드럼들) {
    if (d.상태 === '소진') continue
    const key = `${d.선종_id}|${d.잔량}|${d.제조표기 ?? ''}|${d.상태}`
    const chip = map.get(key)
    if (chip) {
      chip.개수 += 1
      chip.드럼ids.push(d.id)
    } else {
      map.set(key, { key, 잔량: d.잔량, 개수: 1, 제조표기: d.제조표기, 잔재: d.잔재, 출고중: d.상태 === '출고중', 드럼ids: [d.id] })
    }
  }
  // 잔량 큰 것 먼저, 출고중은 맨 뒤 (잔재는 잔량이 작아 자연히 뒤로 밀린다)
  return [...map.values()].sort((a, b) => Number(a.출고중) - Number(b.출고중) || b.잔량 - a.잔량)
}

export function calc스탯(드럼들: Derived드럼[], 선종들: 자재_선종Row[]) {
  const 전압of = new Map(선종들.map((s) => [s.id, s.전압]))
  let 고압재고 = 0, 저압재고 = 0, 잔재드럼수 = 0
  for (const d of 드럼들) {
    if (d.상태 !== '재고') continue // 출고 중인 드럼은 창고에 없다
    const 전압 = 전압of.get(d.선종_id)
    if (전압 === '고압') 고압재고 += d.잔량
    else if (전압 === '저압') 저압재고 += d.잔량
    if (d.잔재) 잔재드럼수 += 1
  }
  return { 고압재고, 저압재고, 잔재드럼수 }
}

export interface FeedItem {
  key: string
  type: '입고' | '출고' | '복귀'
  일자: string
  생성일: string
  line1: string
  line2: string
}

const fmt = (n: number) => n.toLocaleString('ko-KR')

/** 입·출고 피드: 케이블(묶음 그룹핑) + 복귀(잔량>0 완료 출고) + 기타 자재(품목·일자·부호별 합산) */
export function buildFeed(
  드럼들: Derived드럼[],
  기록들: 자재_드럼기록Row[],
  선종들: 자재_선종Row[],
  품목들: 자재_품목Row[],
  품목기록들: 자재_품목기록Row[],
): FeedItem[] {
  const 코드of = new Map(선종들.map((s) => [s.id, s.코드]))
  const 드럼of = new Map(드럼들.map((d) => [d.id, d]))
  const items: FeedItem[] = []

  // 입고: 입고묶음 × 초기길이 그룹
  {
    const groups = new Map<string, { 드럼: 자재_드럼Row; n: number }>()
    for (const d of 드럼들) {
      const key = `${d.입고묶음}|${d.선종_id}|${d.초기길이}`
      const g = groups.get(key)
      if (g) g.n += 1
      else groups.set(key, { 드럼: d, n: 1 })
    }
    for (const [key, { 드럼: d, n }] of groups) {
      items.push({
        key: `in-${key}`, type: '입고', 일자: d.입고일, 생성일: d.생성일,
        line1: `${코드of.get(d.선종_id)} ${fmt(d.초기길이)}m ×${n}`,
        line2: [d.사용처공사 ? `사용처: ${d.사용처공사}` : '사용처 미지정', d.제조표기].filter(Boolean).join(' · '),
      })
    }
  }

  // 출고 (사용량별 그룹) + 복귀 (기록 완료 & 드럼별 그 시점 잔량 > 0)
  {
    const outGroups = new Map<string, { rec: 자재_드럼기록Row; n: number }>()
    // 드럼별 누적 잔량 계산을 위해 기록을 (출고일, id) 순으로 정렬
    const byDrum = new Map<number, 자재_드럼기록Row[]>()
    for (const r of 기록들) {
      const list = byDrum.get(r.드럼_id)
      if (list) list.push(r)
      else byDrum.set(r.드럼_id, [r])
    }
    const 잔량후 = new Map<number, number>() // 기록id → 그 기록 직후 잔량
    for (const [드럼id, recs] of byDrum) {
      const d = 드럼of.get(드럼id)
      if (!d) continue
      let 잔 = d.초기길이
      for (const r of [...recs].sort((a, b) => a.출고일.localeCompare(b.출고일) || a.id - b.id)) {
        잔 = Math.max(0, 잔 - (r.사용량 ?? 0))
        잔량후.set(r.id, 잔)
      }
    }
    const backGroups = new Map<string, { rec: 자재_드럼기록Row; 잔: number; n: number }>()
    for (const r of 기록들) {
      const d = 드럼of.get(r.드럼_id)
      if (!d) continue
      // 출고중 표시는 드럼 길이를 보여주므로 길이가 다르면 한 줄로 묶지 않는다
      const outKey = r.사용량 === null
        ? `${r.출고묶음}|${d.선종_id}|null|${d.초기길이}`
        : `${r.출고묶음}|${d.선종_id}|${r.사용량}`
      const og = outGroups.get(outKey)
      if (og) og.n += 1
      else outGroups.set(outKey, { rec: r, n: 1 })
      if (r.사용량 !== null && r.복귀일 !== null) {
        const 잔 = 잔량후.get(r.id) ?? 0
        if (잔 > 0) {
          const backKey = `${r.출고묶음}|${d.선종_id}|${잔}`
          const bg = backGroups.get(backKey)
          if (bg) bg.n += 1
          else backGroups.set(backKey, { rec: r, 잔, n: 1 })
        }
      }
    }
    for (const [key, { rec, n }] of outGroups) {
      const d = 드럼of.get(rec.드럼_id)!
      const 코드 = 코드of.get(d.선종_id)
      items.push({
        key: `out-${key}`, type: '출고', 일자: rec.출고일, 생성일: rec.생성일,
        line1: rec.사용량 === null
          ? `${코드} ${fmt(d.초기길이)}m 드럼 ×${n} (출고 중)`
          : `${코드} ${fmt(rec.사용량)}m ×${n}`,
        line2: [rec.공사명, d.제조표기].filter(Boolean).join(' · '),
      })
    }
    for (const [key, { rec, 잔, n }] of backGroups) {
      const d = 드럼of.get(rec.드럼_id)!
      items.push({
        key: `back-${key}`, type: '복귀', 일자: rec.복귀일!, 생성일: rec.생성일,
        line1: `${코드of.get(d.선종_id)} ${fmt(잔)}m ×${n} 잔재`,
        line2: [`${rec.공사명}에서 복귀`, d.제조표기].filter(Boolean).join(' · '),
      })
    }
  }

  // 기타 자재: (품목, 일자, 부호)로 합산 — 스테퍼 연타가 여러 행이어도 피드는 한 줄
  {
    const 품목of = new Map(품목들.map((p) => [p.id, p]))
    const groups = new Map<string, { rec: 자재_품목기록Row; sum: number }>()
    for (const r of 품목기록들) {
      const key = `${r.품목_id}|${r.일자}|${r.변화량 > 0 ? '+' : '-'}|${r.공사명 ?? ''}`
      const g = groups.get(key)
      if (g) g.sum += r.변화량
      else groups.set(key, { rec: r, sum: r.변화량 })
    }
    for (const [key, { rec, sum }] of groups) {
      const p = 품목of.get(rec.품목_id)
      if (!p) continue
      items.push({
        key: `etc-${key}`, type: sum > 0 ? '입고' : '출고', 일자: rec.일자, 생성일: rec.생성일,
        line1: `${p.분류} ${p.품명} ${fmt(Math.abs(sum))}${p.단위}`,
        line2: rec.공사명 ?? '수량 조정',
      })
    }
  }

  return items
    .sort((a, b) => b.일자.localeCompare(a.일자) || b.생성일.localeCompare(a.생성일))
    .slice(0, 200) // 피드는 최근 200건까지만 (잔량 계산과 무관한 표시 상한)
}

export interface TL항목 {
  일자: string
  종류: '입고' | '출고' | '복귀'
  제목: string
  상세?: string
  미복귀?: boolean
  기록id?: number
  최대사용가능?: number // 미복귀 복귀 기입 시 상한 = 그 시점 잔량
}

export function build타임라인(드럼: Derived드럼, 기록들: 자재_드럼기록Row[]): TL항목[] {
  const recs = 기록들
    .filter((r) => r.드럼_id === 드럼.id)
    .sort((a, b) => a.출고일.localeCompare(b.출고일) || a.id - b.id)
  const items: TL항목[] = [{
    일자: 드럼.입고일, 종류: '입고',
    제목: `입고${드럼.사용처공사 ? ` ← ${드럼.사용처공사}` : ''} · ${드럼.초기길이.toLocaleString('ko-KR')}m`,
  }]
  let 잔 = 드럼.초기길이
  for (const r of recs) {
    if (r.사용량 === null) {
      items.push({ 일자: r.출고일, 종류: '출고', 제목: `출고 → ${r.공사명}`, 상세: '출고 중 — 사용량 미기입', 미복귀: true, 기록id: r.id, 최대사용가능: 잔 })
      continue
    }
    잔 = Math.max(0, 잔 - r.사용량)
    items.push({ 일자: r.출고일, 종류: '출고', 제목: `출고 → ${r.공사명}`, 상세: `사용 ${r.사용량.toLocaleString('ko-KR')}m · 잔량 ${잔.toLocaleString('ko-KR')}m 자동 계산` })
    if (r.복귀일 !== null && 잔 > 0) {
      items.push({ 일자: r.복귀일, 종류: '복귀', 제목: `잔재 복귀 · ${잔.toLocaleString('ko-KR')}m`, 상세: '창고 보관 중 — 다음 공사에서 바로 사용 가능' })
    }
  }
  // 표시용 시간순 정렬 — 복귀는 복귀일 기준이라 출고일 순서와 어긋날 수 있다 (안정 정렬이라 같은 날짜의 출고→복귀 쌍은 유지)
  return items.sort((a, b) => a.일자.localeCompare(b.일자))
}
