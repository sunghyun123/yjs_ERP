# 금요일 기준 폐지 — 주를 매달 1일에서 자른다 (PR-A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 금요일 기준 주차 규칙을 없애고, ERP 공무·매출손익·대시보드 API의 '한 달'을 전부 **달력 월(1일~말일)**로 맞춘다. 주는 공무 화면에 남기되 달을 걸친 주는 1일에서 자른다.

**Architecture:** 주의 소속을 정하는 규칙은 `gongmu/_lib/주차.ts`의 `주조각()` 하나다. 지금 규칙은 "해가 바뀌면 1/1에서 자르고, 아니면 금요일의 달"(11/12 PR-1)이고, 이걸 **"달이 바뀌면 1일에서 자르고, 아니면 그 달"**로 넓힌다. 소비자(공무 화면, 매출손익 나눠 보기 표, 대시보드 API `split`·`?month`·`?year`)는 기간을 직접 계산하지 않고 `주차.ts`만 거치므로 같이 따라온다. 그 뒤로는 죽은 코드(달력 비교 설명줄), 중복 읽기(route 투입실적 2회), 거짓이 된 이름·문구를 정리한다. yjs_Dashboard는 동작 변경 없이 문구만 고친다(Part 2).

**Tech Stack:** TypeScript · Next.js 16 · vitest (yjs_erp) / 바닐라 JS · FastAPI (yjs_Dashboard)

**진행 문서 (먼저 읽기):** `docs/superpowers/specs/2026-11-17-revenue-simplification-roadmap.md` — §3-1 결정, §7-A 미결이 이 계획의 출발점. 끝나면 그 문서 §5·§6을 갱신한다.

**티어:** A (회계 정합성 + 타임존 지뢰 + 다른 레포가 쓰는 API의 기간 변경). 게이트 3~5는 Task 8.

---

## 게이트 1 결정 (2026-11-17)

| 질문 | 고른 안 | 근거 (조성현) |
|---|---|---|
| 큰 방향 | **(가) 주는 남기고 매달 1일에서 자른다** | 담당자 불편이 "월말 주에 두 줄"로 끝나고, 주간 보고서를 쓰는 사람에게 '이번 주'가 남는다 |
| D1 매출손익 금요일 표 | **(a) 표는 두고 이름만 '시공·준공 나눠 보기'로** | 입력 기간(진행 문서 §4)에 준공 반영이 줄어드는 걸 보여야 한다. 준공 반영 팝업이 PR-B 미입력 목록의 씨앗 |
| D2 '금요일' 이름 | **(a) 바꾼다, 규칙 커밋과 이름 커밋을 나눈다** | 이름이 거짓이 되면 금요일 규칙이 남아 있다고 오해한다 |
| D3 route 투입실적 2회 읽기 | **한 번으로 줄인다**, 응답 모양은 그대로 | 두 기간이 같아졌다 |
| D4 yjs_Dashboard | **동작 변경 없음, 문구만 고치는 PR(Part 2)** | 대시보드는 ERP의 `split.month`·`from`·`to`를 따른다 |

기각: (나) 주 개념을 없애고 달력 월만 남기기 — 주간 보고서 날짜를 담당자가 손으로 골라야 한다. D1-(b) 표 삭제 — PR-B에서 비슷한 걸 다시 만든다.

## 결정 사항 (이 계획에서 정함)

1. **자르는 조건은 "월요일과 일요일의 달이 다르다" 하나.** 해 경계도 이 조건에 포함되므로 해 전용 분기는 사라진다.
   - 10/26(월)~11/1(일) 주 → 10월 5주차 `10/26~10/31` + 11월 1주차 `11/1~11/1`.
   - 결과적으로 `소속월Of(날짜)`는 항상 그 날짜의 달(`ymd.slice(0,7)`)이 되고, `주목록기간(달의주목록(월))`은 항상 `[월-01, 다음달-01)`이다. 이 두 성질을 테스트로 못 박는다(Task 1).
2. **알려진 모양 — 하루짜리 주, 6주짜리 달.** 1일이 일요일인 달(2026-11, 2027-08 등)은 1주차가 `11/1~11/1` 하루고, 말일이 월요일인 달은 마지막 주가 하루다(2026-11의 6주차 `11/30~11/30`, 2026-08의 6주차 `8/31~8/31`). 그래서 2026-11은 6주다(2026-11-17 실행 검증). 첫날이 일요일인 조각은 보통 비어 있다. 규칙 하나로 끝내기 위해 그대로 둔다(따로 합치면 '이 달 1주차는 예외'라는 규칙이 하나 더 생긴다). 게이트 3에서 조성현이 화면을 보고 거슬리면 그때 다시 정한다.
3. **열쇠는 그대로 진짜 월요일.** 잘린 주의 두 조각은 열쇠(`월요일`)가 같고 `시작`/`끝`이 다르다. PR-1에서 해 경계용으로 만든 구조를 매달로 쓰는 것이라 `erp-실적.ts`·`ActualsSheet`·`GongmuActualsView`의 '· 금주' 판정(`w.월요일 === 금주월요일 && 선택.월 === 금주월`)은 바꿀 필요가 없다.
4. **공무 화면의 '달력 비교 설명줄'은 지운다.** `build달력비교`·`설명줄`·`조회기간`·`달력기간`은 "주 기준과 달력 기준이 왜 다른가"를 설명하려고 만든 것인데, 둘이 같아지면 항상 "달력 기준 N월과 같음"만 찍는 죽은 코드가 된다. 그 자리에 고정 문구 한 줄을 둔다.
5. **이름 바꾸기 목록 (Task 6, 별도 커밋)**

   | 지금 | 바꾼 뒤 |
   |---|---|
   | `금주소속월기간` (주차.ts) | `이번달기간` |
   | `_lib/금요일성과.ts` / `.test.ts` | `_lib/시공준공성과.ts` / `.test.ts` |
   | `build금요일성과` / `금요일월성과` | `build시공준공성과` / `시공준공월성과` |
   | `sales/_components/FridayPerformanceTable.tsx` | `BreakdownPerformanceTable.tsx` |
   | `sales/_components/FridayDetailDialog.tsx` | `BreakdownDetailDialog.tsx` |
   | `SalesBasis = 'month-end' \| 'friday'`, `?basis=friday` | `SalesView = 'project' \| 'breakdown'`, `?view=breakdown` |
   | 버튼 '말일 기준' / '금요일 기준' | '공사별' / '시공·준공 나눠 보기' |

   내부 변수 `금주월`·`금주월요일`은 그대로 둔다(뜻이 "오늘이 속한 달/주"라 여전히 참이다).
   옛 링크 `?basis=friday`는 기본 화면(공사별)으로 열린다. 북마크가 깨지는 정도라 따로 옮기지 않는다.
6. **지난 달 숫자가 바뀐다.** 예) 10월은 9/28~11/1에서 10/1~10/31이 된다. 공무 화면·대시보드 연간 표의 지난 달 실적과 달성률이 움직인다. 목표 숫자는 그대로다. 배포 전에 조성현이 사장님께 알린다(Task 0에서 바뀌는 폭을 실측해 둔다).

## 범위에서 뺀 것

- 준공 반영(잔여성과) 자체 — PR-C. 이 PR에서는 '나눠 보기' 표에 그대로 보인다.
- 미입력 목록 — PR-B.
- 대시보드 홈 레이아웃 — 진행 문서 §4 범위 밖.

## 파일 구조

**yjs_erp (Part 1, 브랜치 `feat/calendar-month-weeks`)**

| 파일 | 바뀌는 것 |
|---|---|
| `src/app/(dashboard)/gongmu/_lib/주차.ts` | `주조각()` 규칙, 주석 · (Task 6) `이번달기간` 이름 |
| `src/app/(dashboard)/gongmu/_lib/주차.test.ts` | 기대값 전면 갱신 + 달력 월 성질 테스트 |
| `src/app/(dashboard)/gongmu/_lib/erp-실적.ts` | `build달력비교`·`설명줄`·`조회기간`·`달력기간`·`날짜금액`·`달력비교` 삭제 |
| `src/app/(dashboard)/gongmu/_lib/erp-실적.test.ts` | 9월 픽스처를 달력 9월로, 삭제된 함수 테스트 제거 |
| `src/app/(dashboard)/gongmu/page.tsx` | `load(기간)` 한 인자로, 설명줄 제거 |
| `src/app/(dashboard)/gongmu/_components/GongmuActualsView.tsx` | `설명` prop → 고정 문구 |
| `src/app/api/kpi/monthly-performance/route.ts` | 투입실적 1회 읽기, 주석 |
| `src/app/api/kpi/monthly-performance/route.test.ts` | 기간 기대값 |
| `src/app/(dashboard)/_lib/금요일성과.ts` → `시공준공성과.ts` | 주석 · (Task 6) 이름 |
| `src/app/(dashboard)/_lib/금요일성과.test.ts` → `시공준공성과.test.ts` | 기대값 · 이름 |
| `src/app/(dashboard)/_lib/monthly-revenue-breakdown.test.ts` | 금요일 기간 테스트 1개 |
| `src/app/(dashboard)/_lib/monthly-revenue-breakdown.ts`, `_lib/monthly-split.ts` | 주석만 |
| `src/app/(dashboard)/sales/page.tsx`, `_components/BasisToggle.tsx`, `YearSelector.tsx`, `FridayPerformanceTable.tsx`→`BreakdownPerformanceTable.tsx`, `FridayDetailDialog.tsx`→`BreakdownDetailDialog.tsx` | 이름·문구·URL |

**yjs_Dashboard (Part 2, 브랜치 `chore/calendar-month-wording`)**: `web/home.js`(문구 1곳 + 주석 4곳 + 없음), `web/home.html`(`?v=`), `web/admin.html`(문구 1곳 + 주석 3곳), `app/api/erp.py`(주석 2곳).

---

## 시작 전

```bash
cd yjs_erp
git switch main && git pull
git switch -c feat/calendar-month-weeks
npx vitest run   # 기준선: 전부 통과 확인 (실패가 있으면 이 PR과 무관한지 먼저 확인)
```

### Task 0: 지난 달 숫자가 얼마나 바뀌는지 실측 (운영 DB, 읽기 전용)

사장님께 "지난 달 숫자가 조금 바뀝니다"라고 알릴 근거. 코드 변경 없음.

- [ ] **Step 1:** 2026-01~2026-10 각 달에 대해 공사이력(`준공정산=false`) 행을 **옛 기간**(금요일 기준, main의 `주목록기간(달의주목록(월))`)과 **새 기간**(`[월-01, 다음달-01)`)으로 각각 행마다 `천원()` 반올림 후 합산. 기존 읽기 전용 스크립트 방식(`scripts/`의 ts-node + service_role, 쓰기 0줄)으로 돌린다. 스크립트는 scratchpad에 두고 레포에 넣지 않는다.
- [ ] **Step 2:** 결과를 이 계획 문서 아래 "실측" 절에 표로 붙인다(월 / 옛 시공 / 새 시공 / 차이). 정산(기성+준공 금회지불액)은 `build월정산내역`으로 같은 두 기간을 센다.
- [ ] **Step 3:** 11/09 분해(10월 = 기간 −95,239 + 준공 +158,016 + 반올림 5)와 대조: 10월 '옛→새' 시공 차이가 그 기간 항과 맞는지 확인. 안 맞으면 멈추고 조성현에게 보고.

#### 실측 (2026-11-17 구현 세션, 운영 DB 읽기 전용)

공사이력(`준공정산=false`) 582행 · 기성 233 · 수주 662. 시공은 행마다 `천원()` 후 합산(공무 화면 방식), 정산은 `build월정산내역`과 같은 식. 단위 천원.

| 월 | 옛 기간 (금요일) | 옛 시공 | 새 시공 | 차이 | 옛 정산 | 새 정산 | 차이 |
|---|---|---|---|---|---|---|---|
| 2026-01 | 01-01~02-01 | 311,383 | 311,383 | 0 | 40,578 | 40,578 | 0 |
| 2026-02 | 02-02~03-01 | 631,727 | 631,727 | 0 | 549,442 | 549,442 | 0 |
| 2026-03 | 03-02~03-29 | 391,080 | 467,711 | +76,631 | 48,090 | 120,349 | +72,259 |
| 2026-04 | 03-30~04-26 | 324,520 | 308,712 | −15,808 | 93,114 | 86,568 | −6,546 |
| 2026-05 | 04-27~05-31 | 211,235 | 150,412 | −60,823 | 118,609 | 52,896 | −65,713 |
| 2026-06 | 06-01~06-28 | 334,268 | 391,519 | +57,251 | 122,408 | 192,408 | +70,000 |
| 2026-07 | 06-29~08-02 | 268,571 | 211,320 | −57,251 | 306,032 | 236,032 | −70,000 |
| 2026-08 | 08-03~08-30 | 470,640 | 472,268 | +1,628 | 156,327 | 156,327 | 0 |
| 2026-09 | 08-31~09-27 | 250,773 | 344,383 | +93,610 | 210,487 | 289,109 | +78,622 |
| 2026-10 | 09-28~11-01 | 494,369 | 399,131 | −95,238 | 389,695 | 311,073 | −78,622 |

- **11/09 분해 대조:** 10월 시공 차이 −95,238은 11/09 기간 항 −95,239와 1천원 어긋난다. 원 단위로 더한 뒤 반올림하면 −95,238.6 → **−95,239로 정확히 같다**(8월 1,627.1 → 1,627, 9월 93,611.5 → 93,611도 같음). 어긋남은 반올림 방식(행마다 vs 합계에서)뿐이다.
- 이웃한 두 달의 차이는 서로 상쇄된다(6월 +57,251 / 7월 −57,251 등) — 월말 주가 옆 달로 옮겨간 것이라 한 해 합은 그대로다(1·2월 0은 PR-1 해 경계 자르기와 2월 1일이 일요일인 덕).
- 11/09 당시 10월 공무 시공 494,834 → 오늘 494,369(−465): 그 사이 10월 이력이 수정됐다. 기간 항에는 영향 없음.

### Task 1: 주차 규칙 테스트 먼저 (실패시킨다)

**Files:** Modify `src/app/(dashboard)/gongmu/_lib/주차.test.ts`

날짜 근거: 2026-09-01 화, 2026-10-01 목, 2026-11-01 일, 2026-12-01 화, 2026-08-01 토, 2026-04-27 월, 2026-10-26 월.

- [ ] **Step 1: `소속월Of` 블록 교체** (22~29줄)

```ts
describe('소속월Of — 그 날짜의 달 (2026-11-17 금요일 기준 폐지)', () => {
  it('9/28(월)은 9월 — 금요일(10/2)의 달이 아니다', () => expect(소속월Of('2026-09-28')).toBe('2026-09'))
  it('10/1(목)은 10월 — 같은 주의 월요일(9/28)과 달이 다르다', () => expect(소속월Of('2026-10-01')).toBe('2026-10'))
  it('4/27(월)은 4월 — 옛 규칙에서 5월로 갈리던 사례', () => expect(소속월Of('2026-04-27')).toBe('2026-04'))
  it('12/28(월)은 2026-12', () => expect(소속월Of('2026-12-28')).toBe('2026-12'))
  it('2026-01 ~ 2027-12 의 모든 날짜에서 소속월 = 날짜의 앞 7글자', () => {
    for (let d = '2026-01-01'; d <= '2027-12-31'; d = addDays(d, 1)) expect(소속월Of(d)).toBe(d.slice(0, 7))
  })
})
```

- [ ] **Step 2: `금주소속월기간` 블록 교체** (31~38줄) — 이름은 Task 6에서 바꾼다

```ts
describe('금주소속월기간 — 대시보드 split 기간 = 오늘의 달력 월', () => {
  it('9/28(월) → 9월, 9/1 ~ 9/30 (to 미포함 10/1)', () =>
    expect(금주소속월기간('2026-09-28')).toEqual({ 월: '2026-09', from: '2026-09-01', to: '2026-10-01' }))
  it('10/1(목) → 10월 — 같은 주의 9/28과 다른 달', () =>
    expect(금주소속월기간('2026-10-01')).toEqual({ 월: '2026-10', from: '2026-10-01', to: '2026-11-01' }))
  it('2027-01-01 → 2027-01, 1/1 ~ 1/31', () =>
    expect(금주소속월기간('2027-01-01')).toEqual({ 월: '2027-01', from: '2027-01-01', to: '2027-02-01' }))
})
```

- [ ] **Step 3: `달의주목록` 블록 교체** (40~57줄)

```ts
describe('달의주목록 — 달을 걸친 주는 1일에서 자른다', () => {
  it('9월 = 9/1~9/6(열쇠 8/31), 9/7, 9/14, 9/21, 9/28~9/30', () => {
    const 주 = 달의주목록('2026-09')
    expect(주.map((w) => w.월요일)).toEqual(['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'])
    expect(주[0]).toMatchObject({ 시작: '2026-09-01', 끝: '2026-09-06', 주차: 1, label: '1주차 9/1~9/6' })
    expect(주[4]).toMatchObject({ 시작: '2026-09-28', 끝: '2026-09-30', 주차: 5, label: '5주차 9/28~9/30' })
  })
  it('10월 = 10/1~10/4(열쇠 9/28)부터 10/26~10/31까지 5주', () => {
    const 주 = 달의주목록('2026-10')
    expect(주.map((w) => w.월요일)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'])
    expect(주[0].label).toBe('1주차 10/1~10/4')
    expect(주[4].label).toBe('5주차 10/26~10/31')
  })
  it('1일이 일요일인 달은 1주차가 하루다 (2026-11: 11/1, 열쇠 10/26)', () => {
    const 주 = 달의주목록('2026-11')
    expect(주[0]).toMatchObject({ 월요일: '2026-10-26', 시작: '2026-11-01', 끝: '2026-11-01', label: '1주차 11/1~11/1' })
    expect(주[1]).toMatchObject({ 월요일: '2026-11-02', 주차: 2 })
  })
  it('토요일에 시작하는 달도 1일부터 (2026-08: 8/1~8/2, 열쇠 7/27)', () => {
    expect(달의주목록('2026-08')[0]).toMatchObject({ 월요일: '2026-07-27', 시작: '2026-08-01', 끝: '2026-08-02' })
  })
  it('월말 주의 두 조각은 열쇠가 같고 범위가 이어진다 (10/26 주)', () => {
    const 시월 = 달의주목록('2026-10').at(-1)!
    const 십일월 = 달의주목록('2026-11')[0]
    expect(시월.월요일).toBe(십일월.월요일)
    expect([시월.시작, 시월.끝, 십일월.시작, 십일월.끝]).toEqual(['2026-10-26', '2026-10-31', '2026-11-01', '2026-11-01'])
  })
  it('2025-12 ~ 2028-02 모든 달의 기간 = 1일 ~ 다음 달 1일 (달력 월)', () => {
    for (let m = '2025-12'; m <= '2028-02'; m = 다음달(m)) {
      expect(주목록기간(달의주목록(m))).toEqual({ from: `${m}-01`, to: `${다음달(m)}-01` })
    }
  })
})
```

- [ ] **Step 4: `resolve선택` 블록 교체** (59~93줄)

```ts
describe('resolve선택', () => {
  it('KST 9/28 월 01:00 (= UTC 9/27 16:00) → 9월 5주차(9/28~9/30)', () => {
    const 오늘 = formatKST(new Date('2026-09-27T16:00:00Z'))
    expect(오늘).toBe('2026-09-28')
    const s = resolve선택(오늘)
    expect(s.월).toBe('2026-09')
    expect(s.선택주).toMatchObject({ 월요일: '2026-09-28', 시작: '2026-09-28', 끝: '2026-09-30' })
    expect(s.금주월요일).toBe('2026-09-28')
  })
  it('KST 10/1 → 10월 1주차(10/1~10/4) — 같은 열쇠 9/28 이지만 달이 다르다', () => {
    const s = resolve선택('2026-10-01')
    expect(s.월).toBe('2026-10')
    expect(s.선택주).toMatchObject({ 월요일: '2026-09-28', 시작: '2026-10-01', 끝: '2026-10-04' })
  })
  it('지난달을 고르면 그 달 마지막 주가 기본 선택', () => {
    const s = resolve선택('2026-10-05', '2026-09')
    expect(s.월).toBe('2026-09')
    expect(s.선택주.월요일).toBe('2026-09-28')
    expect(s.이전가능).toBe(true) // 하한은 2026-01
    expect(s.다음가능).toBe(true)
  })
  it('week 파라미터가 그 달의 주면 그 주를 고른다', () => {
    expect(resolve선택('2026-10-05', '2026-09', '2026-09-07').선택주.월요일).toBe('2026-09-07')
  })
  it('week 파라미터가 그 달의 주가 아니면 무시한다', () => {
    expect(resolve선택('2026-10-05', '2026-09', '2026-10-05').선택주.월요일).toBe('2026-09-28')
  })
  it('하한(2026-01) 이전·금주 달 이후·형식 오류 month는 기본(금주 달)로', () => {
    expect(resolve선택('2026-10-05', '2025-12').월).toBe('2026-10')
    expect(resolve선택('2026-10-05', '2026-11').월).toBe('2026-10')
    expect(resolve선택('2026-10-05', '2026-9').월).toBe('2026-10')
    expect(resolve선택('2026-10-05', '2026-10').다음가능).toBe(false)
  })
  it('연 경계: 2026-12-28 은 12월 5주차 12/28~12/31', () => {
    const s = resolve선택('2026-12-28')
    expect(s.월).toBe('2026-12')
    expect(s.금주월).toBe('2026-12')
    expect(s.선택주).toMatchObject({ 월요일: '2026-12-28', 시작: '2026-12-28', 끝: '2026-12-31', label: '5주차 12/28~12/31' })
  })
})
```

- [ ] **Step 5: `조회월기간` 블록의 기간 기대값 갱신** (111~165줄)
  - '지난 달: 2026-10' → `기간: { 월: '2026-10', from: '2026-10-01', to: '2026-11-01' }`, 제목 `'지난 달: 2026-10 → 10/1~10/31 (to 미포함 11/1)'`
  - '9월: 2026-09' → `{ 월: '2026-09', from: '2026-09-01', to: '2026-10-01' }`
  - 'KST 경계' 테스트 두 개를 **달 첫날**로 옮긴다(이제 판단 단위가 날짜라 위험한 순간은 매달 1일 00~09시):

```ts
  it('KST 경계: 2026-12-01(화) 00:30 KST = UTC 11/30 15:30 → 12월이 허용된다', () => {
    const 오늘 = formatKST(new Date('2026-11-30T15:30:00Z'))
    expect(오늘).toBe('2026-12-01')
    expect(조회월기간('2026-12', 오늘)).toEqual({
      ok: true,
      기간: { 월: '2026-12', from: '2026-12-01', to: '2027-01-01' },
    })
  })
  it('같은 순간을 UTC 날짜(toISOString)로 읽으면 11/30 → 12월이 거절된다 — 호출부가 KST를 넘겨야 하는 이유', () => {
    const utc날짜 = new Date('2026-11-30T15:30:00Z').toISOString().slice(0, 10)
    expect(utc날짜).toBe('2026-11-30')
    expect(조회월기간('2026-12', utc날짜).ok).toBe(false)
  })
```
  - 나머지(상한·하한·형식·연 경계 2027-01) 테스트는 그대로 둔다.

- [ ] **Step 6: '해를 넘기지 않는 주' 블록 갱신** (167~221줄)
  - '2026-01 기간 = 1/1 ~ 2/1' → `{ 월: '2026-01', from: '2026-01-01', to: '2026-02-01' }`, 제목에서 '(to 미포함 2/2)' → '(to 미포함 2/1)'
  - '2026-12 기간' → `{ 월: '2026-12', from: '2026-12-01', to: '2027-01-01' }`, 제목 '2026-12 기간 = 12/1 ~ 12/31'
  - '해 경계가 아닌 주는 기존 규칙 그대로 (금요일의 달)' 테스트를 지운다(Step 1이 대신한다).
  - 빈틈·겹침 테스트, 잘린 주 테스트, KST 00:30 테스트, 최소월 테스트는 그대로.
  - describe 제목을 `'해 경계 (달 경계 자르기의 특수한 경우)'`로.

- [ ] **Step 7: 실행해서 실패를 확인**

Run: `npx vitest run "src/app/(dashboard)/gongmu/_lib/주차.test.ts"`
Expected: FAIL — 소속월Of(9/28)이 `2026-10`, 9월 주 목록이 `8/31~9/6`으로 시작하는 등 금요일 규칙 결과가 나온다.

### Task 2: `주차.ts` 구현

**Files:** Modify `src/app/(dashboard)/gongmu/_lib/주차.ts`

- [ ] **Step 1: 파일 머리 주석(2~18줄) 교체**

```ts
/**
 * 공무 주간 보고서의 주차 규칙 (2026-11-17 금요일 기준 폐지 — 진행 문서 2026-11-17-revenue-simplification-roadmap.md §3-1)
 *
 * - 한 주 = 월~일.
 * - 한 달 = 달력 월(1일~말일). ERP 공무·매출손익·대시보드가 전부 같은 기간을 본다.
 * - 달을 걸친 주는 1일에서 자른다: 앞 조각은 앞 달, 뒤 조각은 새 달. (예: 10/26~11/1 → 10월 5주차 10/26~31 + 11월 1주차 11/1)
 *   그래서 소속월Of(날짜) = 그 날짜의 달이고, 한 달의 주 목록은 정확히 1일~말일을 덮는다.
 *   1일이 일요일인 달은 1주차가 하루다(2026-11-01) — 예외 규칙을 만들지 않으려고 그대로 둔다.
 * - 잘린 주의 두 조각은 열쇠(주정보.월요일 = 진짜 월요일)가 같고 시작·끝이 다르다.
 *   끝을 addDays(월요일, 6)로 구하지 말 것.
 * - 이전 규칙: 2026-09-28~11-16 "그 주 금요일의 달"(주간 보고서를 금요일에 써서), 2026-11-12 해 경계만 자르기.
 *   사장님 입장에서 금요일 기준은 숫자가 화면마다 달라지는 원인일 뿐이라 폐지했다. 보고서가 ERP에 맞춘다.
 *
 * 날짜는 전부 'YYYY-MM-DD' 문자열로 다루고, 산술은 명시적 UTC 자정('...T00:00:00Z')에서만 한다.
 * 로컬 시계(서버=UTC, 브라우저=KST)에 따라 날짜가 밀리지 않게 하려는 것.
 * '오늘'은 이 파일이 정하지 않는다 — 호출부가 todayKST()로 넘긴다.
 */
```

- [ ] **Step 2: `주조각` 교체** (57~70줄)

```ts
/**
 * 한 주(월~일)를 달 경계에서 자른 조각. 달을 안 넘으면 1개, 넘으면 2개(앞 달·새 달).
 * 주의 소속을 정하는 규칙은 이 함수 하나다 — 소속월Of·달의주목록이 모두 여기만 거친다.
 * 해 경계도 달 경계라 따로 다루지 않는다.
 */
function 주조각(월요일: string): 조각[] {
  const 일요일 = addDays(월요일, 6)
  const 앞달 = 월요일.slice(0, 7)
  const 뒷달 = 일요일.slice(0, 7)
  if (앞달 === 뒷달) return [{ 시작: 월요일, 끝: 일요일, 소속월: 앞달 }]
  const 새달첫날 = `${뒷달}-01`
  return [
    { 시작: 월요일, 끝: addDays(새달첫날, -1), 소속월: 앞달 },
    { 시작: 새달첫날, 끝: 일요일, 소속월: 뒷달 },
  ]
}
```

- [ ] **Step 3: 주석만 고친다**
  - `소속월Of` 위 주석(72줄): `/** 그 날짜가 속한 달 = 날짜의 달. 주조각을 거치는 이유는 규칙을 한 곳에 두려는 것(테스트가 slice(0,7)과 같음을 고정) */`
  - `달의주목록` 안 주석(94줄): `// 이 달에 조각이 걸칠 수 있는 주 = 1일이 든 주 ~ 다음 달 1일이 든 주 (다음 달 1일이 든 주는 앞 조각만 이 달)`
  - `금주소속월기간` 주석(111~115줄): `오늘의 달력 월과 그 기간. 대시보드 실적(도넛·담당자별 진척)이 공무 화면과 같은 기간을 보게 한다. 예) 오늘 9/28 → 9월, 9/1~9/30.`
  - `조회월기간` 주석(137줄): '그 달의 금요일 기준 기간' → '그 달의 기간(달력 월)'. 141줄: '새 달 첫 주 월요일 00~09시에' → '매달 1일 00~09시에'.
  - `연간조회월목록` 주석(171~173줄): '금요일 기준 기간' → '기간(달력 월)', 'PR-1(해 경계 자르기) 덕에' → '달 경계 자르기 덕에'.

- [ ] **Step 4: 실행**

Run: `npx vitest run "src/app/(dashboard)/gongmu/_lib/주차.test.ts"`
Expected: PASS (연간조회월목록 블록 포함 전부)

- [ ] **Step 5: 나머지 테스트가 어디서 깨지는지 본다** (다음 Task들의 목록)

Run: `npx vitest run`
Expected: FAIL은 `erp-실적.test.ts`, `금요일성과.test.ts`, `monthly-revenue-breakdown.test.ts`, `route.test.ts`에서만 나온다. 다른 파일에서 실패하면 멈추고 원인을 본다(기간을 직접 계산하는 소비자가 숨어 있다는 뜻).

### Task 3: 공무 — 기대값 갱신 + 달력 비교 설명줄 삭제

**Files:** Modify `gongmu/_lib/erp-실적.ts`, `erp-실적.test.ts`, `gongmu/page.tsx`, `gongmu/_components/GongmuActualsView.tsx`

- [ ] **Step 1: `erp-실적.test.ts` 픽스처를 달력 9월로**
  - 7줄 주석: `const 주9월 = 달의주목록('2026-09') // 9/1 ~ 9/30`
  - import에서 `build달력비교, 설명줄, 조회기간` 제거.
  - `describe('조회기간', ...)` 블록(35~39줄)과 `describe('build달력비교 / 설명줄', ...)` 블록(90~129줄) 삭제.
  - `build담당자별실적` 픽스처(42~51줄):

```ts
  const 행들 = [
    행('2026-09-01', 1_627_000, 7),   // 9월 1주차(9/1~9/6, 열쇠 8/31)
    행('2026-09-22', 9_687_400, 7),   // 4주차
    행('2026-09-23', 2_404_600, 9),   // 4주차
    행('2026-09-23', 530_000, null),  // 미지정
    행('2026-09-24', -200_000, 7),    // 음수 유지
    행('2026-09-10', null, 9),        // null = 0
    행('2026-09-15', 3_000_000, 42),  // 목록에 없는 담당자
    행('2026-10-01', 5_000_000, 7),   // 10월 → 제외
  ]
```
  - 김무선 테스트의 날짜 기대값: `['2026-09-01', '2026-09-22', '2026-09-24']`
  - 검산 테스트: 제목 `'(10월 10/1 행 제외)'`, 필터 `x.작업일자 >= '2026-09-01' && x.작업일자 < '2026-10-01'`
  - 정산 줄 블록의 `'주 기준 기간 밖(9월 주차의 9/28)은 빠진다'`(177줄): 그 테스트가 쓰는 9/28 날짜를 `2026-10-01`로, 제목 `'기간 밖(10/1)은 빠진다'`. (테스트를 열어 정산 행의 날짜 칸만 바꾼다 — 금액·담당 기대값은 그대로)

- [ ] **Step 2: 실행해서 통과 확인 (삭제 전 코드로도 통과해야 한다 — 테스트만 바꿨으므로)**

Run: `npx vitest run "src/app/(dashboard)/gongmu"`
Expected: PASS

- [ ] **Step 3: `erp-실적.ts`에서 죽은 코드 삭제**
  - `달력기간`, `조회기간`, `날짜금액`, `달력비교`, `build달력비교`, `md`, `설명줄`을 지운다(64~69줄 `주기준기간` 상수는 남긴다).
  - import에서 `다음달`이 더 안 쓰이면 지운다(`tsc`가 알려준다).

- [ ] **Step 4: `gongmu/page.tsx`**

```ts
import { resolve선택, 주목록기간 } from './_lib/주차'
import { build담당자별실적, type 담당자, type 원이력행 } from './_lib/erp-실적'
```
  `load`를 한 인자로:

```ts
async function load(
  기간: { from: string; to: string },
): Promise<{ 담당자목록: 담당자[]; 행들: 원이력행[]; 정산행들: 월정산내역Row[] } | null> {
```
  본문의 `주기간.from, 주기간.to` → `기간.from, 기간.to`. 호출부:

```ts
  // 공사이력·정산 모두 그 달 1일~말일 — 주 목록이 정확히 그 기간을 덮는다(주차.ts 테스트로 고정)
  const 데이터 = await load(주목록기간(선택.주목록))
```
  끝부분:

```ts
  const 실적 = build담당자별실적(행들, 담당자목록, 선택.주목록, 선택.선택주.월요일, 정산행들)

  return <GongmuActualsView 선택={선택} 실적={실적} 담당자목록={담당자목록} />
```

- [ ] **Step 5: `GongmuActualsView.tsx`** — props에서 `설명`을 빼고(14·18줄), 81줄을 고정 문구로:

```tsx
        <p className="text-xs text-gray-500 mt-3 border-t border-gray-100 pt-3">
          달력 월(1일~말일) 기준 · 월말에 걸친 주는 1일에서 나눕니다
        </p>
```

- [ ] **Step 6: 확인**

Run: `npx vitest run "src/app/(dashboard)/gongmu" && npx tsc --noEmit`
Expected: PASS, 타입 에러 0

### Task 4: 매출손익 나눠 보기 표 — 기대값 갱신

**Files:** Modify `src/app/(dashboard)/_lib/금요일성과.test.ts`, `_lib/monthly-revenue-breakdown.test.ts`

- [ ] **Step 1: `금요일성과.test.ts` 표시 범위 블록**
  - '표시하는 달에는 주차.ts 의 기간을 그대로 싣는다' → 제목 `(10월 = 10/1 ~ 11/1 미포함)`, `expect(r.from).toBe('2026-10-01')`, `expect(r.to).toBe('2026-11-01')`
  - '1월 기간' → `['2026-01-01', '2026-02-01']`, 제목 `'1월 기간 = 1/1 ~ 2/1 미포함 (2025-12-29~31 이관행이 빠진다)'`
  - '12월 기간' → `['2026-12-01', '2027-01-01']`, 제목 `'12월 기간 = 12/1 ~ 2027-01-01 미포함'`

- [ ] **Step 2: 시공 기록 블록의 첫 테스트 교체**

```ts
  it('달력 월로 자른다 — 9/28 은 9월, 11/1 은 11월', () => {
    const rows = build금요일성과(
      [
        이력(1, '2026-09-28', 5_000_000), // 옛 금요일 규칙에선 10월
        이력(1, '2026-10-31', 3_000_000),
        이력(1, '2026-11-01', 7_000_000), // 옛 규칙에선 10월 마지막 주
      ],
      [수주({ id: 1 })],
      2026,
      '2026-11',
    )
    expect(월(rows, '2026-09').시공기록천원).toBe(5_000)
    expect(월(rows, '2026-10').시공기록천원).toBe(3_000)
    expect(월(rows, '2026-11').시공기록천원).toBe(7_000)
  })
```

- [ ] **Step 3: 준공 반영 블록의 첫 테스트 교체**

```ts
  it('준공일의 달에 얹는다 (9/29 준공 → 9월)', () => {
    const rows = build금요일성과(
      [],
      [수주({ id: 1, 준공여부: true, 준공일: '2026-09-29', 준공액_공급가: 10_000_000 })],
      2026,
      '2026-11',
    )
    expect(월(rows, '2026-09').준공반영천원).toBe(10_000)
    expect(월(rows, '2026-10').준공반영천원).toBe(0)
  })
```

- [ ] **Step 4: 공사별 목록 블록 주석**(176줄) `// 10월(9/28~11/2 미포함)` → `// 10월(10/1~11/1 미포함)`. 픽스처 날짜는 전부 10월 안이라 그대로.

- [ ] **Step 5: `monthly-revenue-breakdown.test.ts`의 금요일 테스트(243줄) 교체**

```ts
  it('달력 월로 자르면 공무 화면의 월 누적과 천원까지 같다 (대시보드 = 공무)', () => {
    // 10월 = 10/1~10/31. 9/30·11/1 은 빠져야 한다
    const 원본 = [
      { id: 1, 수주_id: 1, 작업일자: '2026-09-30', 성과금액: 7_000_000 },
      { id: 2, 수주_id: 1, 작업일자: '2026-10-01', 성과금액: 1_499 },
      { id: 3, 수주_id: 1, 작업일자: '2026-10-02', 성과금액: 1_499 },
      { id: 4, 수주_id: 2, 작업일자: '2026-10-15', 성과금액: 2_300_400 },
      { id: 5, 수주_id: 2, 작업일자: '2026-10-31', 성과금액: -500_600 },
      { id: 6, 수주_id: 3, 작업일자: '2026-11-01', 성과금액: 9_000_000 },
    ]
    const 기간 = 금주소속월기간('2026-10-15')
    const 대시보드 = sum월성과내역(build월시공내역(원본, [수주({ id: 1 }), 수주({ id: 2 }), 수주({ id: 3 })], [], 기간.from, 기간.to))
    const 공무 = build담당자별실적(
      원본.map((r) => ({ ...r, 담당공무_id: null, 지중no: '', 공사명: '' })),
      [],
      달의주목록(기간.월),
      '2026-10-12',
    ).월누적합천원
    // 행마다 반올림: 1 + 1 + 2,300 + (-501) = 1,801
    expect(대시보드).toBe(1801)
    expect(대시보드).toBe(공무)
  })
```

- [ ] **Step 6: 실행**

Run: `npx vitest run "src/app/(dashboard)/_lib"`
Expected: PASS

### Task 5: API route — 투입실적 1회 읽기 + 기대값

**Files:** Modify `src/app/api/kpi/monthly-performance/route.ts`, `route.test.ts`

- [ ] **Step 1: 테스트 먼저 — `month 없음` 블록의 두 테스트 교체** (91~108줄)

```ts
  it('응답 = 기존 KPI 칸 전부 + split, 칸이 하나도 빠지거나 늘지 않는다', async () => {
    const res = await GET(요청())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ...가짜KPI, split: 가짜split('2026-11', '2026-11-01', '2026-12-01') })
    expect(Object.keys(body).sort()).toEqual([...Object.keys(가짜KPI), 'split'].sort())
  })

  it('split 기간 = 기존 칸과 같은 달력 월, 투입실적은 한 번만 읽어 둘이 나눠 쓴다', async () => {
    await GET(요청())
    expect(m.getMonthlySplit).toHaveBeenCalledTimes(1)
    expect(m.getMonthlySplit.mock.calls[0][1]).toEqual({ 월: '2026-11', from: '2026-11-01', to: '2026-12-01' })
    expect(m.load투입원가재료).toHaveBeenCalledTimes(1)
    expect(m.getMonthlySplit.mock.calls[0][3]).toBe(m.getMonthlyKpiData.mock.calls[0][3])
  })

  it('KST 매달 1일 00:30(= UTC 전날 15:30)에도 split 달 = 기존 칸 달 (둘 다 KST)', async () => {
    지금은('2026-11-30T15:30:00Z') // KST 12/1 00:30
    await GET(요청())
    expect(m.getMonthlySplit.mock.calls[0][1]).toEqual({ 월: '2026-12', from: '2026-12-01', to: '2027-01-01' })
    expect(m.load투입원가재료.mock.calls[0][1]).toMatchObject({ monthStart: '2026-12-01', monthEnd: '2027-01-01' })
  })
```

- [ ] **Step 2: `month 있음` 블록 기대값**
  - '?month=2026-10' 테스트: 제목 `'?month=2026-10 → 10월 기간(10/1~10/31), 달력 월 KPI 는 계산하지 않는다'`, `가짜split('2026-10', '2026-10-01', '2026-11-01')`, `{ 월: '2026-10', from: '2026-10-01', to: '2026-11-01' }`, `monthStart: '2026-10-01', monthEnd: '2026-11-01'`
  - 'KST 경계' 테스트: 제목 `'KST 경계: 2026-12-01 00:30 KST(= UTC 11/30 15:30)에 ?month=2026-12 는 200'`, `지금은('2026-11-30T15:30:00Z')`, 기대 `가짜split('2026-12', '2026-12-01', '2027-01-01')`
  - '최소월 2026-01' 테스트: 제목 `'... 기간은 1/1 ~ 2/1 미포함'`, `to: '2026-02-01'`
- [ ] **Step 3: `?year=` 블록** '투입실적은 1월 1일 ~ 진행중 달 끝까지' → `monthEnd: '2026-12-01'`

- [ ] **Step 4: 실행해서 실패 확인**

Run: `npx vitest run src/app/api/kpi`
Expected: FAIL — `load투입원가재료`가 2번 불린다(새 테스트), 나머지는 Task 2 덕에 통과.

- [ ] **Step 5: `route.ts` 수정**
  - 머리 주석 5줄: `?month 없음 → { ...MonthlyKpiData(달력 월), split(같은 달력 월) | null } — 지금까지와 같은 모양`
  - 98줄 주석: `// 야간 표기용 투입실적 — 그 달 기간으로 읽는다. year 는 split 이 읽지 않는다`
  - 108~136줄의 `month 없음` 경로:

```ts
  try {
    const supabase = createAdminClient()
    // 기존 칸(amounts·breakdown)과 split 은 같은 달력 월이다(2026-11-17 금요일 기준 폐지).
    // 공사이력·투입실적을 한 번씩만 읽어 두 계산이 나눠 쓴다.
    // 두 기간 모두 KST 로 정한다 — getMonthlyPeriod 는 partsKST, 이번달 기간은 formatKST(now)
    const period = getMonthlyPeriod(now)
    const 기간 = 금주소속월기간(formatKST(now))
    const 성과재료Promise = load성과재료(supabase)
    const 투입재료Promise = load투입원가재료(supabase, period)

    const [data, split] = await Promise.all([
      getMonthlyKpiData(supabase, now, 성과재료Promise, 투입재료Promise),
      // split 만의 실패(기성 전 테이블 조회 등)는 기존 칸까지 끌고 내려가지 않는다 — split: null 로 보내면
      // 새 대시보드는 대체값 경로로 가고, split 을 모르는 옛 대시보드는 아무 영향이 없다.
      // (공유 재료가 실패하면 getMonthlyKpiData 도 실패하므로 그때는 예전처럼 500)
      getMonthlySplit(supabase, 기간, 성과재료Promise, 투입재료Promise).catch((error: unknown) => {
        console.error('[kpi/monthly-performance] split 계산 실패 — split: null 로 응답', error)
        return null
      }),
    ])
    // split 은 '추가'다 — 기존 칸(amounts·breakdown 등)의 값과 의미는 그대로 두어 옛 대시보드가 깨지지 않게 한다
    return NextResponse.json({ ...data, split })
  } catch (error) {
    return 실패응답(error)
  }
```

- [ ] **Step 6: 실행**

Run: `npx vitest run src/app/api/kpi`
Expected: PASS

- [ ] **Step 7: 전체 + 타입**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 전부 PASS, 타입 에러 0. 여기까지가 **커밋 1(규칙 변경)**의 내용이다 — 커밋은 Task 8 게이트 5에서 조성현이 메시지를 쓴다. 이름 바꾸기와 섞이지 않게 **여기서 먼저 커밋 1을 만든다**(게이트 3·4는 커밋 2까지 끝난 뒤 한 번에).

- [ ] **Step 8: 커밋 1** — 조성현이 메시지를 쓴다. 넣을 파일: Task 1~5에서 바꾼 파일 + 이 계획 문서 + 진행 문서(`docs/superpowers/specs/2026-11-17-revenue-simplification-roadmap.md`, 기획 세션에서 미커밋으로 둔 것).

### Task 6: 이름 정리 (커밋 2)

동작 변경 0줄. 바꾼 뒤 테스트가 그대로 통과해야 한다.

- [ ] **Step 1: 파일 이름** (git이 이력을 잇게 `git mv`)

```bash
cd "src/app/(dashboard)"
git mv _lib/금요일성과.ts _lib/시공준공성과.ts
git mv _lib/금요일성과.test.ts _lib/시공준공성과.test.ts
git mv sales/_components/FridayPerformanceTable.tsx sales/_components/BreakdownPerformanceTable.tsx
git mv sales/_components/FridayDetailDialog.tsx sales/_components/BreakdownDetailDialog.tsx
cd ../../..
```

- [ ] **Step 2: 식별자 바꾸기** — 아래 표를 레포 전체(`src/`)에 적용하고, 남은 것이 없는지 grep으로 확인한다.

| 찾기 | 바꾸기 |
|---|---|
| `금주소속월기간` | `이번달기간` |
| `build금요일성과` | `build시공준공성과` |
| `금요일월성과` | `시공준공월성과` |
| `'../_lib/금요일성과'`, `'../../_lib/금요일성과'`, `'./금요일성과'` | `…/시공준공성과` |
| `FridayPerformanceTable` | `BreakdownPerformanceTable` |
| `FridayDetailDialog` | `BreakdownDetailDialog` |
| (sales/page.tsx) `금요일rows` | `나눔rows` |

Run: `grep -rn "금요일\|Friday\|friday" src --include=*.ts --include=*.tsx`
Expected: 남은 줄은 '옛 규칙'을 설명하는 주석(주차.ts 머리 주석 "이전 규칙" 등)뿐. 그 외가 나오면 Step 4의 문구 목록에 추가해 처리한다.

- [ ] **Step 3: `BasisToggle.tsx` 전체 교체**

```tsx
// src/app/(dashboard)/sales/_components/BasisToggle.tsx
'use client'

import { useRouter } from 'next/navigation'

/** 표 보기: 공사별 성과 / 시공 기록·준공 반영·성과 세 줄(월별). 기간은 둘 다 달력 월이다 */
export type SalesView = 'project' | 'breakdown'

/**
 * 표만 바꾸는 스왑 버튼. 상태는 URL(?view=breakdown)에 둔다 — 새로고침·링크 공유에도 같은 화면이 나오고,
 * 서버 컴포넌트가 그 값으로 다시 그린다(클라이언트 state 를 따로 두면 서버가 그린 표와 어긋날 수 있다).
 */
export function BasisToggle({ year, view }: { year: number; view: SalesView }) {
  const router = useRouter()
  const go = (next: SalesView) =>
    router.push(next === 'breakdown' ? `/sales?year=${year}&view=breakdown` : `/sales?year=${year}`)

  const btn = (value: SalesView, label: string) => (
    <button
      type="button"
      onClick={() => go(value)}
      aria-pressed={view === value}
      className={
        view === value
          ? 'px-3 h-9 text-sm bg-blue-600 text-white'
          : 'px-3 h-9 text-sm bg-white text-gray-600 hover:bg-gray-50'
      }
    >
      {label}
    </button>
  )

  return (
    <div className="inline-flex overflow-hidden rounded-md border border-gray-200 shadow-sm">
      {btn('project', '공사별')}
      {btn('breakdown', '시공·준공 나눠 보기')}
    </div>
  )
}
```

- [ ] **Step 4: `YearSelector.tsx`**

```tsx
import type { SalesView } from './BasisToggle'

export function YearSelector({ currentYear, view }: { currentYear: number; view: SalesView }) {
```
  12~13줄:

```tsx
  // 연도를 바꿔도 보던 표(나눠 보기)를 유지한다 — 안 그러면 연도만 바꿨는데 표가 공사별로 돌아간다
  const suffix = view === 'breakdown' ? '&view=breakdown' : ''
```

- [ ] **Step 5: `sales/page.tsx`**
  - `searchParams: Promise<{ year?: string; view?: string }>`, `const { year: yearParam, view: viewParam } = await searchParams`
  - 21~22줄: `// 모르는 값(옛 ?basis=friday 포함)은 조용히 공사별로` / `const view: SalesView = viewParam === 'breakdown' ? 'breakdown' : 'project'`
  - import `BasisToggle, type SalesView`, `BreakdownPerformanceTable`, `build시공준공성과`, `이번달기간`
  - 34줄 주석: `// 나눠 보기 표도 같은 재료(공사이력 전 기간·수주)를 쓴다 — 두 표가 다른 순간의 DB를 보지 않게 한 번만 읽는다`
  - 38~42줄:

```tsx
  // 표시 범위의 끝(이번 달)은 KST 로 정한다 — 서버 시계(UTC)로 정하면 매달 1일 00~09시에 한 달 밀린다
  const 나눔rows =
    view === 'breakdown'
      ? build시공준공성과(재료.공사이력전체, 재료.수주, year, 이번달기간(todayKST()).월)
      : null
```
  - `<BasisToggle year={year} view={view} />`, `<YearSelector currentYear={year} view={view} />`
  - 111줄 주석: `{/* 표 — 스왑 버튼은 이 카드만 바꾼다. KPI·차트·표 모두 달력 월 */}`
  - 116줄 제목: `` `${year}년 월별 성과 — 시공·준공 나눠 보기 (천원)` ``
  - 122줄: `<BreakdownPerformanceTable rows={나눔rows} />`

- [ ] **Step 6: `BreakdownPerformanceTable.tsx` 문구**
  - 12줄 주석: `* 월별 성과(달력 월) — 시공 기록 / 준공 반영 / 성과 세 줄.`
  - 83줄 각주: `단위 천원 · 달력 월(1일~말일) 기준`
  - 줄 정의의 `hint`는 그대로(`'공무 화면 월 누적과 같은 숫자'`는 이제도 참).

- [ ] **Step 7: `시공준공성과.ts` 머리 주석(2~8줄)**

```ts
/**
 * 매출손익 '시공·준공 나눠 보기' 표 — 월별 성과를 시공 기록과 준공 반영으로 나눠 보여준다 (2026-11-10, 2026-11-17 달력 월로)
 *
 * 시공 기록 = 공사이력.성과금액만, 달력 월, 행마다 천원 반올림 → 공무 화면 월 누적과 천원까지 같다
 * 준공 반영 = 그 달에 준공한 공사의 (준공액 − 시공 전 기간 누계) → 시공 기록에 없던 몫(= 미입력 이력의 크기)
 * 진행 문서 2026-11-17-revenue-simplification-roadmap.md §3-3: 이력을 채울수록 준공 반영이 줄고, PR-C에서 이 줄을 없앤다.
```

- [ ] **Step 8: 주석만 남은 곳**
  - `_lib/monthly-split.ts:135` → `/** 이 실적이 속한 달 'YYYY-MM' — 달력 월(공무 화면과 같은 규칙) */`
  - `_lib/monthly-revenue-breakdown.ts:36` → `* 위 일자의 전체 날짜('YYYY-MM-DD'). 옛 ERP(금요일 기준, ~2026-11-16)는 달을 넘나들어 '일'만으로 달을 몰랐다 — 대시보드가 이 칸을 읽으므로 유지한다.`

- [ ] **Step 9: 확인**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: 전부 PASS. 테스트 개수가 커밋 1과 같다(이름만 바꿨으므로).

- [ ] **Step 10: 커밋 2** — 조성현이 메시지를 쓴다.

### Task 7: 화면 확인 (로컬, 운영 DB 읽기)

- [ ] **Step 1:** `npm run build` 성공 확인 후 `npm run dev`.
- [ ] **Step 2: 공무** `/gongmu?month=2026-10`
  - 주 칩: `1주차 10/1~10/4` … `5주차 10/26~10/31`. 설명 줄이 고정 문구.
  - 10월 누적 = Task 0 실측의 '새 시공 10월'과 같은지.
  - `/gongmu?month=2026-11` 1주차 칩 `11/1~11/1`.
- [ ] **Step 3: 매출손익** `/sales?view=breakdown`
  - 10월 시공 기록 = 공무 10월 누적(천원 일치).
  - 10월 성과천원 × 1,000 ≈ 위 차트 10월 성과(원). 차이는 반올림뿐(행 수 × 최대 500원). **진행 문서 §7-A-5 검증**: 이제 공무 시공과 매출손익 성과의 차이 = 준공 반영 + 반올림이다(기간 항 0).
  - 버튼 '공사별' ↔ '시공·준공 나눠 보기' 전환, 연도 바꿔도 보기 유지, `/sales?basis=friday`는 공사별로 열림.
- [ ] **Step 4: API** — 로컬 키로 `curl -H "Authorization: Bearer $DASHBOARD_API_KEY" "http://localhost:3000/api/kpi/monthly-performance"`: `split.from`이 `2026-11-01`, `split.to`가 `2026-12-01`, `period.monthStart`와 같은 달. `?year=2026`의 10월 `split.from`이 `2026-10-01`.

### Task 8: 게이트 3·4·5 (PR 전)

- [ ] **게이트 3 리뷰 관점:**
  ① 기간을 직접 계산하는 소비자가 남았나 — `grep -rn "addDays(.*, 4)\|금요일\|getUTCDay" src` (금요일 판정이 다른 곳에 복사돼 있으면 그곳만 옛 규칙으로 남는다).
  ② `split`과 기존 칸이 정말 같은 달을 보나 — `getMonthlyPeriod`(partsKST)와 `이번달기간(formatKST(now))`이 다른 시계를 읽는 자리가 없는가(Task 5 Step 1 세 번째 테스트).
  ③ 하루짜리 1주차(`11/1~11/1`) 화면을 조성현이 보고 그대로 둘지 결정.
  ④ 지운 `설명줄`을 다른 곳(대시보드·문서)이 참조하지 않나.
- [ ] **게이트 4 질문 후보 (1~2개):**
  1. (타임존, 면접 모드) route가 `formatKST(now)` 대신 `now.toISOString().slice(0,10)`을 넘겼다면, 2026-12-01 KST 03:00에 `?month` 없는 응답의 `split.month`와 기존 칸 `label`은 각각 몇 월인가? 그 창은 몇 시부터 몇 시까지이고, **판단 단위가 '주'에서 '날짜'로 바뀐 지금** 위험한 날은 1년에 며칠인가? (11/12 PR-1 때는 새 달 첫 주 월요일이었다)
  2. (같은 원본 두 기록) 매출손익 위 차트의 10월 성과와 나눠 보기 표의 10월 성과천원이 둘 다 같은 공사이력에서 나오는데 몇 천원 다를 수 있다. 무엇이 같고 무엇이 달라서인가? 이 차이가 "어디서나 일치"(진행 문서 §2)를 깨나?
- [ ] **게이트 5:** 커밋 메시지는 조성현이 쓴다(커밋 1·2 각각). PR 본문에 "지난 달 숫자가 바뀐다"(Task 0 표)와 Part 2(대시보드 문구 PR)를 적는다.
- [ ] **진행 문서 갱신:** `2026-11-17-revenue-simplification-roadmap.md` §5 표(PR-A 구현 → 완료/PR 번호), §6에 하루짜리 1주차 결정 등 이 계획에서 정한 것을 한 줄씩.
- [ ] **푸시 → PR → 머지 (이 세션에서 한 번만, 진행 문서 세션 규칙 4):** 기획 세션의 미커밋 문서(이 계획 문서, 진행 문서)가 커밋 1에 들어갔는지 확인 → `git push -u origin feat/calendar-month-weeks` → `gh pr create` → 조성현 확인 후 머지. Part 2도 같은 순서로. 운영 배포는 조성현이 따로 한다.
- [ ] **세션 보고서 (이 세션에서 한 번만):** 전역 CLAUDE.md §7 형식. PR-A 기획 세션 내용(게이트 1 결정)까지 합쳐서 쓴다. 이어서 PR-B 기획 세션 프롬프트를 쓴다.

---

## Part 2 — yjs_Dashboard 문구 (별도 PR, ERP 배포와 같은 날 배포)

동작 변경 0줄. ERP가 달력 월을 보내기 시작하면 아래 문구가 거짓이 된다.

```bash
cd yjs_Dashboard
git switch main && git pull
git switch -c chore/calendar-month-wording
```

- [ ] **Step 1: 화면에 보이는 문구 2곳**
  - `web/home.js` `periodSubText()`(309줄): `` return ` · 기간 ${md(from)}~${md(last.toISOString().slice(0, 10))}`; `` — `(금요일 기준 주차)` 제거. 함수 위 주석: `// 팝업 부제에 붙일 집계 기간(달력 월). 옛 ERP(금요일 기준)일 때 달력 월과 달랐던 것을 그 자리에서 말하려고 만든 것 — 지금은 1일~말일이다.`
  - `web/admin.html`(737줄): `` : !isErpMonth ? `ERP 실적은 이번 달(${adminErpActual.label})만 불러옵니다 — 지정된 것만 표시` ``
- [ ] **Step 2: 주석만** — 아래 줄의 '금요일 기준 주차의 달'을 '달력 월'로, '9/28~30 엔 …' 예시 문장을 지운다: `web/home.js` 38~39, 267~268, 663~664, 709, 865; `web/admin.html` 576, 690~691, 1128; `app/api/erp.py` 109, 166. 동작 코드(정규식·분기)는 건드리지 않는다 — 옛 ERP 하위호환 경로라 그대로 둔다.
- [ ] **Step 3:** `web/home.html`의 `home.js?v=20261113b` → `?v=20261117a` (안 올리면 브라우저 캐시의 옛 home.js가 옛 문구를 계속 띄운다).
- [ ] **Step 4: 확인** — `grep -rn "금요일" web app` 결과가 `dashboard.calendar-mockup.html`(요일 이름, 무관)뿐. 기존 테스트(`pytest`)가 있으면 실행.
- [ ] **Step 5:** 커밋·PR — 조성현이 메시지를 쓴다.

## 배포 (조성현)

1. 사장님께 먼저 알린다: "이제 모든 화면의 한 달이 1일~말일입니다. 지난 달 숫자가 조금씩 바뀝니다(Task 0 표). 주간 보고서는 공무 페이지 기준으로 씁니다."
2. ERP 배포 → 대시보드 Part 2 배포(같은 날).
3. 공무 담당자에게 주간 보고서 작성 기준 안내(월말 주는 두 줄).
4. 배포 후 확인: 대시보드 홈 도넛 팝업 부제 기간이 `11/1~11/30`, 관리자 화면 문구.

## Self-review

- 진행 문서 §7-A 대응: 1 → D1(a) Task 6, 2 → D2 Task 6, 3 → D3 Task 5, 4 → 결정 6(목표 숫자 그대로, 달성률만 움직임 — Task 0 실측 + 배포 고지), 5 → Task 7 Step 3.
- `소속월Of` 의미가 "금요일의 달"에서 "날짜의 달"로 바뀌는 것이 깨뜨리는 곳: 호출부는 주차.ts 안과 테스트뿐(`resolve선택`·`조회월기간`·`연간조회월목록`·`금주소속월기간`). Task 2 Step 5가 다른 실패를 잡는다.
- `erp-실적.ts`의 `주기준기간 = 주목록기간` 상수는 남긴다 — 대시보드와 같은 함수를 쓴다는 표시라 지울 이유가 없다.
- 날짜 요일 근거는 Task 1 머리에 적었다(테스트가 틀린 요일을 전제하면 통과해도 의미가 없다 — 11/12 PR-1 설계 문서의 2026-12-29 오타 전례).
