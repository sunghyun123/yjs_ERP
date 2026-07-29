# 수주 폼 작업구분 입력 칸 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 수주 등록·수정 폼의 "계약 정보" 섹션에 `작업구분`(고압/저압/보수) 선택 칸을 추가한다.

**Architecture:** DB 컬럼 `수주.작업구분`과 조회(`page.tsx`)·타입(`수주행`)이 **이미 존재**하고 이관 데이터도 들어있다 — 폼 노출만 빠진 상태다. 따라서 마이그레이션·쿼리 변경 없이 `OrderForm.tsx` 한 파일에서 옵션 배열·zod 스키마·defaultValues·submit payload·UI 4열 배치만 손댄다.

**Tech Stack:** Next.js 16 (클라이언트 컴포넌트) · react-hook-form + zod · shadcn/ui Select

**Spec:** `docs/superpowers/specs/2026-07-29-orders-filter-upgrade-design.md` (§4.5)

**Branch:** `feat/orders-work-type-field` — main에서 분기. 필터 고도화 플랜과 파일이 겹치지 않게 이 플랜은 `OrderForm.tsx`의 **계약 정보 섹션과 스키마만** 건드린다.

---

## 사전 확인 사항 (2026-07-29 실 DB 564건 조사 결과)

| 사실 | 근거 | 이 플랜에 미치는 영향 |
| --- | --- | --- |
| `수주.작업구분 text null` 컬럼 존재 | `src/types/database.ts:106` | **마이그레이션 불필요** |
| 이관 스크립트가 엑셀 4번째 열에서 적재 | `scripts/migrate-수주.ts:48,201` | 기존 값이 이미 있다 |
| `수주행` 타입·`page.tsx` 조회에 이미 포함 | `orders/_types.ts:20`, `orders/page.tsx:13` | **쿼리·타입 변경 불필요** |
| 기존 값 = 저압 330 · 고압 176 · 보수 19 · NULL 39 | 실 DB 조사 | 신규 선택지와 **정확히 일치** — 목록 밖 값을 위한 폴백 옵션이 필요 없다 |

**폴백을 넣지 않는 이유:** `공사현장` 칸은 과거 자유 입력 이력 때문에 "목록에 없는 기존 값을 임시 옵션으로 노출"하는 장치를 갖고 있다(`OrderForm.tsx:784`). 작업구분은 이관이 통제된 3개 값만 넣었고 조사에서 예외가 0건이라 같은 장치를 복사하지 않는다. 대신 Task 2에서 세 값 각각을 실제로 열어 확인한다.

**테스트 인프라 주의:** 이 레포에는 jsdom·testing-library가 없고 `vitest.config.ts`의 include가 `src/**/*.test.ts`다 — **React 컴포넌트 테스트가 존재하지 않는다.** 이 변경은 폼 배선(선언적 매핑)이라 단위 테스트로 가둘 대상이 없으므로, 검증은 타입체크·lint·실화면 대조로 한다(Task 2). 테스트 인프라를 새로 세우는 것은 이 플랜의 범위가 아니다.

---

## Task 1: 작업구분 필드 배선 + UI 배치

**Files:**
- Modify: `src/app/(dashboard)/orders/_components/OrderForm.tsx` (5군데: 옵션·스키마·defaultValues·payload·JSX)

- [ ] **Step 1: 브랜치 생성**

```bash
git checkout main
git pull
git checkout -b feat/orders-work-type-field
```

- [ ] **Step 2: 옵션 배열 추가**

`OrderForm.tsx`의 옵션 목록(원본 31~35행)에 한 줄 넣는다. `공사종류옵션` 아래가 자연스럽다.

```ts
// ── 옵션 목록 ──────────────────────────────────────────────────────────────
const 공사구분옵션 = ['총가', '단가', '민수', '관급']
const 공사종류옵션 = ['지중', '가공', '혼합']
const 작업구분옵션 = ['고압', '저압', '보수']
const 시공상태옵션 = ['미시공', '시공중', '완료']
const 정산상태옵션 = ['1차기성', '2차기성', '3차기성', '4차기성', '5차기성', '완료']
```

- [ ] **Step 3: zod 스키마에 필드 추가**

원본 46행 `공사현장` 아래에 한 줄 넣는다. 다른 분류 필드와 같은 형태(선택 입력)다.

```ts
  공사현장:        z.string().optional(),
  작업구분:        z.string().optional(),
  발주자_id:       z.number().int().nullable().optional(),
```

- [ ] **Step 4: defaultValues에 추가 (수정 모드에서 저장값이 채워지도록)**

원본 402행 아래에 한 줄 넣는다.

```ts
          공사현장:        row.공사현장 ?? '',
          작업구분:        row.작업구분 ?? '',
          발주자_id:       row.발주자_id ?? null,
```

`mode === 'new'`의 else 분기(원본 418~421행)는 손대지 않는다 — 신규 등록의 작업구분은 미선택(`undefined`)에서 출발하고, Step 5의 payload가 `null`로 저장한다.

- [ ] **Step 5: submit payload에 추가**

원본 459행 아래에 한 줄 넣는다. `|| null`은 빈 문자열(미선택)을 DB NULL로 보내기 위한 것이고, 다른 분류 필드와 같은 관례다.

```ts
      공사현장:        values.공사현장?.trim() || null,
      작업구분:        values.작업구분 || null,
      발주자_id:       values.발주자_id ?? null,
```

- [ ] **Step 6: UI를 3열에서 2열×2행으로 바꾼다**

원본 746~802행(`{/* 공사구분 · 공사종류 · 공사현장 — 3열 */}` 주석부터 그 `</div>`까지)을 아래로 **전부 교체**한다. 3열에 4개를 밀어넣으면 셀렉트가 좁아져 값이 잘리므로 2×2로 간다.

```tsx
              {/* 공사구분 · 공사종류 — 2열 */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="공사구분">
                  <Controller
                    name="공사구분"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value || '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {공사구분옵션.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field label="공사종류">
                  <Controller
                    name="공사종류"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value || '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {공사종류옵션.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>

              {/* 공사현장 · 작업구분 — 2열 */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="공사현장">
                  <Controller
                    name="공사현장"
                    control={control}
                    render={({ field }) => {
                      // edit 모드에서 과거 자유입력 값이 목록에 없으면 임시 옵션으로 노출
                      const opts = field.value && !공사현장목록.includes(field.value)
                        ? [field.value, ...공사현장목록]
                        : 공사현장목록
                      return (
                        <Select
                          value={field.value || '__none__'}
                          onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                        >
                          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">—</SelectItem>
                            {opts.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )
                    }}
                  />
                </Field>
                <Field label="작업구분">
                  <Controller
                    name="작업구분"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value || '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {작업구분옵션.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>
```

- [ ] **Step 7: 타입체크·lint**

Run: `npx tsc --noEmit`
Expected: 에러 0. `작업구분`이 `FormValues`에 없다는 에러가 나면 Step 3이 빠졌다.

Run: `npm run lint`
Expected: 에러 0.

Run: `npm test`
Expected: PASS 전부 (이 변경은 기존 테스트를 건드리지 않는다).

- [ ] **Step 8: 커밋**

```bash
git add "src/app/(dashboard)/orders/_components/OrderForm.tsx"
git commit -m "feat(orders): 수주 폼 계약 정보에 작업구분 입력 칸 추가

작업구분은 DB 컬럼·조회·타입이 이미 있고 폼 노출만 빠져 있어서,
이관된 값(저압 330·고압 176·보수 19)을 화면에서 고칠 수 없었다.
3열에 4개를 넣으면 셀렉트가 좁아져 값이 잘리므로 2열×2행으로 재배치."
```

---

## Task 2: 실화면 대조 검증

컴포넌트 테스트가 없으므로 이 단계가 유일한 검증이다. **저장값이 조용히 날아가지 않는지**가 핵심이다.

**Files:** 없음 (검증만)

- [ ] **Step 1: 개발 서버 실행**

Run: `npm run dev` → `http://localhost:3000/orders`

- [ ] **Step 2: 기존 값 세 종류가 폼에 채워지는지 확인 (가장 중요)**

수주 행을 열어(행 클릭) 계약 정보 섹션의 작업구분 칸을 본다. **저압·고압·보수 각각 최소 1건**을 찾아 확인한다. 검색창에 지중No를 넣어 여러 건을 돌아보면 된다.

Expected: DB에 든 값이 그대로 선택돼 보인다. 빈 칸(`선택`)으로 보이면 Step 4(defaultValues)가 빠졌거나 값 문자열이 옵션과 미세하게 다르다(공백·전각 문자).

- [ ] **Step 3: 미입력 건이 `—`로 보이는지**

작업구분이 비어 있는 건(39건 중 하나)을 열어본다.
Expected: `—`가 선택된 상태로 보이고 에러가 없다.

- [ ] **Step 4: 값을 바꿔 저장하면 실제로 반영되는지**

아무 건의 작업구분을 다른 값으로 바꾸고 저장 → 폼을 닫고 같은 건을 다시 연다.
Expected: 바꾼 값이 유지된다. 되돌아가면 Step 5(payload)가 빠졌다.

- [ ] **Step 5: 작업구분을 건드리지 않은 저장이 기존 값을 지우지 않는지 (회귀 위험 지점)**

작업구분이 `고압`인 건을 열어 **작업구분은 손대지 않고** 다른 칸(예: 참고사항)만 고쳐 저장 → 다시 연다.
Expected: 작업구분이 여전히 `고압`이다. `—`로 바뀌었다면 defaultValues가 값을 못 받아온 채 payload가 null을 써 넣은 것이다 — Step 4의 defaultValues를 다시 확인한다.

- [ ] **Step 6: 신규 등록에서 미선택으로도 저장되는지**

`새 수주` 버튼 → 지중No·공사명만 채우고 작업구분은 그대로 둔 채 저장.
Expected: 저장 성공하고, 다시 열면 작업구분이 `—`다.

- [ ] **Step 7: 2×2 배치가 깨지지 않는지**

Expected: 공사구분·공사종류가 한 줄, 공사현장·작업구분이 다음 줄. 각 셀렉트의 값이 잘리지 않고 보인다. 창을 좁혀도 레이아웃이 무너지지 않는다.

- [ ] **Step 8: 검증 결과 기록 후 커밋**

`PROGRESS.md`에 레포 기존 형식으로 한 항목 추가한다(작업구분은 DB에 이미 있었고 폼 노출만 빠져 있었다는 사실, 실측 값 분포, 검증 완료).

```bash
git add PROGRESS.md
git commit -m "docs(progress): 수주 폼 작업구분 입력 칸 검증 기록"
```

---

## 완료 조건

- [ ] `npx tsc --noEmit` 에러 0
- [ ] `npm run lint` 에러 0
- [ ] `npm test` PASS 전부
- [ ] Task 2의 Step 2·5가 통과 — **기존 값이 폼에 채워지고, 다른 칸만 고쳐 저장해도 살아남는다**
- [ ] PR 생성 (main 대상)

## 이 플랜이 건드리지 않는 것

- 작업구분 조회 필터 (요청 범위 밖 — 필요하면 별건)
- 미입력 39건 백필
- 목록 밖 값을 위한 폴백 옵션 (조사에서 예외 0건 — 위 "사전 확인 사항" 참고)
- 필터 고도화 전체 → 별도 플랜 `2026-07-29-orders-filter-upgrade.md`
