// src/app/(dashboard)/materials/_lib/derive.test.ts
import { describe, it, expect } from 'vitest'
import { derive드럼, derive품목, group칩, calc스탯, buildFeed, build타임라인, group기타자재, 품목라벨, 품목전체명 } from './derive'
import { fetchAll } from './fetch-all'
import type { 자재_드럼Row, 자재_드럼기록Row, 자재_선종Row, 자재_품목Row, 자재_품목기록Row } from '@/types/database'

const 선종들: 자재_선종Row[] = [
  { id: 1, 코드: 'CA95', 전압: '고압', 정렬: 2 },
  { id: 2, 코드: '35SQ', 전압: '저압', 정렬: 1 },
]

function 드럼(over: Partial<자재_드럼Row> & { id: number }): 자재_드럼Row {
  return { 선종_id: 1, 초기길이: 500, 제조표기: '대일 26.02', 입고일: '2026-07-01',
    사용처공사: null, 입고묶음: 'b1', 생성일: '2026-07-01T00:00:00Z', 작성자: null, ...over }
}
function 기록(over: Partial<자재_드럼기록Row> & { id: number; 드럼_id: number }): 자재_드럼기록Row {
  return { 출고일: '2026-07-05', 공사명: '군포중 지중화공사', 사용량: null, 복귀일: null,
    출고묶음: 'o1', 생성일: '2026-07-05T00:00:00Z', 작성자: null, ...over }
}

describe('derive드럼 — 잔량·상태는 기록에서 파생', () => {
  it('기록 없는 새 드럼: 잔량=초기길이, 상태=재고, 잔재 아님', () => {
    const [d] = derive드럼([드럼({ id: 1 })], [])
    expect(d.잔량).toBe(500)
    expect(d.상태).toBe('재고')
    expect(d.잔재).toBe(false)
  })
  it('사용량 기입된 출고: 잔량 차감, 잔재=true', () => {
    const [d] = derive드럼([드럼({ id: 1 })], [기록({ id: 1, 드럼_id: 1, 사용량: 430, 복귀일: '2026-07-05' })])
    expect(d.잔량).toBe(70)
    expect(d.상태).toBe('재고')
    expect(d.잔재).toBe(true)
  })
  it('사용량 null 출고 = 출고 중', () => {
    const [d] = derive드럼([드럼({ id: 1 })], [기록({ id: 1, 드럼_id: 1 })])
    expect(d.상태).toBe('출고중')
  })
  it('누적 사용량 = 초기길이 → 소진', () => {
    const [d] = derive드럼([드럼({ id: 1 })], [
       기록({ id: 1, 드럼_id: 1, 사용량: 300, 복귀일: '2026-07-05' }),
      기록({ id: 2, 드럼_id: 1, 사용량: 200, 복귀일: '2026-07-08' }),
    ])
    expect(d.잔량).toBe(0)
    expect(d.상태).toBe('소진')
  })
})

describe('group칩 — 같은 (잔량·표기·상태) 드럼을 ×n 칩으로', () => {
  it('동일 드럼 3개 → 칩 1개 ×3, 소진 드럼은 제외', () => {
    const 드럼들 = derive드럼(
      [드럼({ id: 1 }), 드럼({ id: 2 }), 드럼({ id: 3 }), 드럼({ id: 4, 초기길이: 100 })],
      [기록({ id: 1, 드럼_id: 4, 사용량: 100, 복귀일: '2026-07-05' })],
    )
    const 칩들 = group칩(드럼들)
    expect(칩들).toHaveLength(1)
    expect(칩들[0].개수).toBe(3)
    expect(칩들[0].드럼ids).toEqual([1, 2, 3])
  })
})

describe('calc스탯', () => {
  it('전압별 재고 합계(출고중 제외) + 잔재 드럼 수', () => {
    const 드럼들 = derive드럼(
      [드럼({ id: 1 }), 드럼({ id: 2, 선종_id: 2, 초기길이: 300 }), 드럼({ id: 3 })],
      [
        기록({ id: 1, 드럼_id: 1, 사용량: 100, 복귀일: '2026-07-05' }), // 고압 잔재 400
        기록({ id: 2, 드럼_id: 3 }),                                    // 출고 중 → 제외
      ],
    )
    const s = calc스탯(드럼들, 선종들)
    expect(s.고압재고).toBe(400)
    expect(s.저압재고).toBe(300)
    expect(s.잔재드럼수).toBe(1)
  })
})

describe('buildFeed', () => {
  it('입고묶음 그룹핑 + 복귀 항목(잔량>0) 생성 + 품목 기록 합산', () => {
    const 드럼들raw = [드럼({ id: 1 }), 드럼({ id: 2 }), 드럼({ id: 3, 초기길이: 100, 입고묶음: 'b2', 입고일: '2026-06-20' })]
    const 기록들 = [기록({ id: 1, 드럼_id: 3, 사용량: 80, 복귀일: '2026-07-02' })]
    const 품목들: 자재_품목Row[] = [{ id: 1, 대분류: '기기', 중분류: '수령 개폐기', 소분류: '3DM', 단위: '대', 정렬: 1 }]
    const 품목기록들: 자재_품목기록Row[] = [
      { id: 1, 품목_id: 1, 변화량: 2, 일자: '2026-07-03', 비고: null, 생성일: '2026-07-03T00:00:00Z', 작성자: null },
      { id: 2, 품목_id: 1, 변화량: 1, 일자: '2026-07-03', 비고: null, 생성일: '2026-07-03T01:00:00Z', 작성자: null },
    ]
    const feed = buildFeed(derive드럼(드럼들raw, 기록들), 기록들, 선종들, 품목들, 품목기록들)
    // 입고 2건(b1: 500m×2, b2: 100m×1) + 출고 1건 + 복귀 1건 + 품목입고 1건(+3 합산)
    expect(feed.filter((f) => f.type === '입고')).toHaveLength(3)
    expect(feed.filter((f) => f.type === '출고')).toHaveLength(1)
    const 복귀 = feed.filter((f) => f.type === '복귀')
    expect(복귀).toHaveLength(1)
    expect(복귀[0].line1).toContain('20m')      // 100 - 80 = 잔량 20 복귀
    expect(feed.find((f) => f.line1.includes('3DM'))!.line1).toContain('3대')
    // 최신 일자가 먼저
    expect(feed[0].일자 >= feed[feed.length - 1].일자).toBe(true)
  })
})

describe('build타임라인', () => {
  it('입고→출고→복귀 순서, 잔량 누적 계산', () => {
    const [d] = derive드럼([드럼({ id: 1, 초기길이: 189, 입고일: '2025-12-26' })],
      [기록({ id: 1, 드럼_id: 1, 출고일: '2026-01-15', 사용량: 76, 복귀일: '2026-01-15' })])
    const tl = build타임라인(d, [기록({ id: 1, 드럼_id: 1, 출고일: '2026-01-15', 사용량: 76, 복귀일: '2026-01-15' })])
    expect(tl[0].종류).toBe('입고')
    expect(tl[1].종류).toBe('출고')
    expect(tl[1].상세).toContain('113')        // 189 - 76
    expect(tl[2].종류).toBe('복귀')
  })
  it('미복귀 출고는 미복귀 플래그 + 기록id 노출(복귀 기입용)', () => {
    const recs = [기록({ id: 7, 드럼_id: 1 })]
    const [d] = derive드럼([드럼({ id: 1 })], recs)
    const tl = build타임라인(d, recs)
    expect(tl[1].미복귀).toBe(true)
    expect(tl[1].기록id).toBe(7)
  })
})

describe('derive품목', () => {
  const 품목들: 자재_품목Row[] = [{ id: 1, 대분류: '기기', 중분류: '수령 개폐기', 소분류: '3DM', 단위: '대', 정렬: 1 }]
  const 기록 = (over: Partial<자재_품목기록Row> & { id: number }): 자재_품목기록Row =>
    ({ 품목_id: 1, 변화량: 1, 일자: '2026-07-01', 비고: null, 생성일: '', 작성자: null, ...over })

  it('수량 = Σ변화량', () => {
    expect(derive품목(품목들, [
      기록({ id: 1, 변화량: 5 }),
      기록({ id: 2, 변화량: -2, 일자: '2026-07-02', 비고: '군포중' }),
    ])[0].수량).toBe(3)
  })
  it('최근비고 = 마지막으로 비고가 적힌 기록 (비고 없는 ＋/− 연타는 건너뛴다)', () => {
    const [p] = derive품목(품목들, [
      기록({ id: 1, 일자: '2026-07-01', 비고: '한전 안양지사' }),
      기록({ id: 2, 일자: '2026-07-05', 비고: null }),   // 스테퍼로 +1 — 비고를 덮지 않는다
      기록({ id: 3, 일자: '2026-07-05', 비고: '   ' }),  // 공백만도 없는 것으로 본다
    ])
    expect(p.최근비고).toBe('한전 안양지사')
  })
  it('같은 날짜면 나중에 입력된 쪽(id 큰 쪽)이 최근', () => {
    const [p] = derive품목(품목들, [
      기록({ id: 9, 일자: '2026-08-01', 비고: '먼저 적음' }),
      기록({ id: 10, 일자: '2026-08-01', 비고: '나중에 적음' }),
    ])
    expect(p.최근비고).toBe('나중에 적음')
  })
  it('비고가 한 번도 없으면 null', () => {
    expect(derive품목(품목들, [기록({ id: 1 })])[0].최근비고).toBeNull()
  })
})

describe('품목 이름 — 3단 계층', () => {
  const 품목 = (over: Partial<자재_품목Row>): 자재_품목Row =>
    ({ id: 1, 대분류: 'CU접속재', 중분류: '', 소분류: '', 단위: '개', 정렬: 1, ...over })

  it('라벨은 가장 아래 채워진 단계', () => {
    expect(품목라벨(품목({ 중분류: '직선용 접속재', 소분류: '325' }))).toBe('325')
    expect(품목라벨(품목({ 중분류: 'TR엘보 접속재' }))).toBe('TR엘보 접속재')  // 소분류 없음
    expect(품목라벨(품목({ 대분류: '단독품목' }))).toBe('단독품목')            // 중·소분류 둘 다 없음
  })
  it('전체명은 빈 단계를 건너뛰고 이어붙인다', () => {
    expect(품목전체명(품목({ 중분류: '직선용 접속재', 소분류: '325' }))).toBe('CU접속재 직선용 접속재 325')
    expect(품목전체명(품목({ 중분류: 'TR엘보 접속재' }))).toBe('CU접속재 TR엘보 접속재')
    expect(품목전체명(품목({ 대분류: '단독품목' }))).toBe('단독품목')
  })
})

describe('group기타자재 — 대분류 > 중분류 2단 묶기', () => {
  const raw: 자재_품목Row[] = [
    { id: 1, 대분류: 'CU접속재', 중분류: '직선용 접속재', 소분류: '60', 단위: '개', 정렬: 1 },
    { id: 2, 대분류: 'CU접속재', 중분류: '직선용 접속재', 소분류: '325', 단위: '개', 정렬: 2 },
    { id: 3, 대분류: 'CU접속재', 중분류: 'TR엘보 접속재', 소분류: '', 단위: '개', 정렬: 3 },
    // 시드엔 없지만 admin이 만들 수 있는 모양(중분류조차 없는 품목) — 그리기 분기가 있으니 덮어둔다
    { id: 4, 대분류: '단독품목', 중분류: '', 소분류: '', 단위: '개', 정렬: 4 },
    { id: 5, 대분류: '기기', 중분류: '수령 개폐기', 소분류: '4DA', 단위: '대', 정렬: 5 },
  ]
  const 기록들: 자재_품목기록Row[] = [
    { id: 1, 품목_id: 2, 변화량: 7, 일자: '2026-08-01', 비고: null, 생성일: '', 작성자: null },
  ]
  const 품목들 = derive품목(raw, 기록들)

  it('정렬 순서대로 대분류 그룹 + 그룹 안 중분류 그룹', () => {
    const g = group기타자재(품목들)
    expect(g.map((x) => x.대분류)).toEqual(['CU접속재', '단독품목', '기기'])
    expect(g[0].중분류들.map((m) => m.중분류)).toEqual(['직선용 접속재', 'TR엘보 접속재'])
    expect(g[0].중분류들[0].품목들.map((p) => p.소분류)).toEqual(['60', '325'])
  })
  it('소분류가 있어야 중분류가 소제목이 된다(같은 글자 두 번 방지)', () => {
    const [cu, 단독] = group기타자재(품목들)
    expect(cu.중분류들[0].소제목).toBe(true)   // 직선용 접속재 > 60 / 325
    expect(cu.중분류들[1].소제목).toBe(false)  // TR엘보 접속재 자체가 품목
    expect(단독.중분류들[0].소제목).toBe(false) // 중분류조차 없음
  })
  it('재고수는 수량 > 0 인 품목 수 — 접힌 카드의 유일한 신호', () => {
    const [cu, , 기기] = group기타자재(품목들)
    expect(cu.총수).toBe(3)
    expect(cu.재고수).toBe(1)
    expect(기기.재고수).toBe(0)
  })
  it('검색: 토큰 전부를 포함해야 하고, 공백은 무시한다', () => {
    expect(group기타자재(품목들, '4DA').map((g) => g.대분류)).toEqual(['기기'])
    // 토큰은 대분류·중분류·소분류를 가로질러 AND로 걸린다
    expect(group기타자재(품목들, 'cu 325')[0].중분류들[0].품목들.map((p) => p.id)).toEqual([2])
    // 공백을 지워 붙여 쳐도 되지만, 한 토큰은 '이어진' 부분이어야 한다
    expect(group기타자재(품목들, '직선용접속재325')[0].중분류들[0].품목들.map((p) => p.id)).toEqual([2])
    expect(group기타자재(품목들, '직선용 325')[0].중분류들[0].품목들.map((p) => p.id)).toEqual([2])
  })
  it('맞는 품목이 없는 그룹은 통째로 빠진다', () => {
    expect(group기타자재(품목들, '없는품목')).toEqual([])
    expect(group기타자재(품목들, '단독')).toHaveLength(1)
  })
  it('검색어가 비면 전체를 그대로 돌려준다', () => {
    expect(group기타자재(품목들, '   ')).toHaveLength(3)
  })
})

describe('derive드럼 — 초과 사용 방어', () => {
  it('Σ사용량 > 초기길이: 잔량 0으로 클램프, 상태=소진', () => {
    const [d] = derive드럼([드럼({ id: 1 })], [
      기록({ id: 1, 드럼_id: 1, 사용량: 400, 복귀일: '2026-07-05' }),
      기록({ id: 2, 드럼_id: 1, 사용량: 200, 복귀일: '2026-07-08' }),
    ])
    expect(d.잔량).toBe(0)
    expect(d.상태).toBe('소진')
  })
})

describe('fetchAll — 1000행 페이징', () => {
  function fetcherOf(total: number, fail = false) {
    const rows = Array.from({ length: total }, (_, i) => i)
    return (from: number, to: number) =>
      Promise.resolve(
        fail
          ? { data: null, error: { message: '연결 실패' } }
          : { data: rows.slice(from, to + 1), error: null },
      )
  }
  it('마지막 페이지가 짧으면 전량 반환 후 종료', async () => {
    await expect(fetchAll(fetcherOf(1500))).resolves.toHaveLength(1500)
  })
  it('총량이 정확히 1000의 배수여도 종료한다(무한루프 방어)', async () => {
    await expect(fetchAll(fetcherOf(2000))).resolves.toHaveLength(2000)
  })
  it('에러는 조용히 삼키지 않고 throw', async () => {
    await expect(fetchAll(fetcherOf(0, true))).rejects.toThrow('자재 데이터 조회 실패')
  })
})
