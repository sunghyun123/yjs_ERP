# 대시보드 1~12월 연간 표 (연간 PR-4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** yjs_Dashboard 홈 아래 표 칸(`.home-table-slot`)에 임시로 있던 월 계획/실적 표(‹ ›)를 **담당자 × 시공/정산 × 계획/실적 × 1~12월 + 합계** 연간 표로 바꾼다. 기본은 접힘(4줄), 시공·정산을 따로 펼치며 펼침 상태는 기기마다 기억한다. 도넛은 항상 이번 달만 보여 준다.

**Architecture:** ERP `?year=` 응답(PR-2, #58)을 대시보드 중계가 허용목록으로 통과시키고(`year`·`상태` 추가), 1~12월 목표는 대시보드 DB에서 **한 번에** 받는다(새 `?year=` 경로). 브라우저는 달마다 기존 `normalize*` + `buildManagerProgress`를 그대로 돌려 칸을 만든다 — 귀속 규칙은 home.js 한 벌뿐이다. 연간 표는 5분, 도넛은 60초로 따로 갱신한다. 대시보드 서버에 GZip을 넣어 브라우저 구간을 압축한다.

**Tech Stack:** FastAPI(중계·SQLite repo, pytest), 정적 HTML + 바닐라 JS(IIFE, 테스트 러너 없음 → `node --check` + 브라우저 실측).

- 설계: `yjs_erp/docs/superpowers/specs/2026-11-12-dashboard-yearly-plan-actual-design.md` §3-5, §4 PR-4, §5-1·§5-2·§5-4·§5-5
- 대상 레포: **yjs_Dashboard** (이 문서만 yjs_erp에 둔다 — 앞 PR 문서들과 같은 자리)
- 선행: ERP PR #58(`?year=`) 머지·배포, 대시보드 PR-3 #51(홈 레이아웃) 머지·배포
- 티어: **A** (실적 귀속·합계 정합성, 캐시/조용한 실패 개념이 걸린다)

---

## 게이트 1 결정 (2026-11-12, 기획 세션)

| # | 질문 | 결정 | 근거(조성현) / 기각 |
|---|---|---|---|
| Q1 | 도넛·‹ › (§5-1) | **도넛 유지(항상 이번 달), ‹ › 삭제** — `monthNavState`·`goPlanActualMonth`·`MIN_PLAN_MONTH`·5분 복귀·순번 처리 삭제 | "한눈에 보이고 로딩도 사라져서". 기각: ‹ ›로 도넛만 이동(상태 두 갈래), 도넛 삭제 |
| Q2 | 1~12월 목표 경로 | **대시보드에 `/api/erp/monthly-progress-config?year=YYYY` 신설** — SQLite 한 번 | "요청이 1번이라 자원을 덜 써서". 기각: `?month=` 12번(부분 실패 상태가 생김) |
| Q3 | 설계의 "계획외 실적 줄" | **펼친 쪽 맨 아래 "담당 미지정" 한 줄**(계획·실적 모두) = `''` 칸 + `unplannedRows` | "이중 계상 위험이 없어서". ERP 모드에선 모든 실적 행에 담당 칸이 붙어 와 '계획외'는 사실상 '미지정'이다. 기각: 계획외를 따로 계산(미지정과 겹침) |
| Q4 | 접힘 기억 | **`localStorage`(시공·정산 각각) + try/catch, 실패하면 접힘** | "새로고침해도 이전 상태 그대로라 헷갈리지 않음". 기억 범위는 그 기기·그 브라우저(전자칠판은 늘 접힘). 기각: sessionStorage, 서버 저장 |
| Q5 | 폴링·크기 | **연간 표 5분 / 도넛 60초 / 대시보드 `GZipMiddleware`** | "ERP 계산 부담이 줄어서" — 연간 응답 1번 = ERP가 12달을 새로 계산(표 4개 + 1년치 투입실적). 대가: 지난 달 담당 수정은 최대 5분 뒤 반영. 기각: 둘 다 60초(화면당 ERP 부하 5배), 중계가 담당×월 합계만 보냄(귀속 규칙 두 벌 — 10/14 기각 구조) |
| Q6 | 1600×900 펼침 | **표 칸 안 세로 스크롤 + 머리줄(월) 고정** | "빽빽하면 지저분해 보여서". 기각: 글자·행간 압축 |
| Q7 | 백만원 반올림 | **천원으로 더하고 화면에 찍을 때만 반올림**, 칸에 마우스를 올리면 천원 값 | "실제 금액과 달라질 일이 없어서". 대가: 화면 칸을 손으로 더하면 합계와 ±1백만원 어긋날 수 있다. 기각: 칸마다 먼저 반올림 |

부수 결정(Claude 기본값 — 구현 게이트 2에서 이의 있으면 바꾼다):
- **연도는 브라우저 시계가 아니라 ERP가 정한다**: 도넛용 month 없는 응답의 `split.month`(`YYYY-MM`) 앞 4자리. 그 값이 없으면(옛 ERP·실패) 연간 표를 부르지 않고 "연간 실적을 불러오지 못했습니다". 연도 선택(‹ 2026 ›, §5-4)은 **이번에 안 만든다**(2027-01 전까지 필요 없음 — 백로그).
- **끝난 달 캐시(§5-5)는 안 만든다** — 5분 폴링으로 부하를 줄였고, 캐시는 '지난 달 담당 수정이 안 보이는' 낡음 문제를 새로 만든다.
- **미래 달**: 실적 칸은 `—`, 계획 칸은 목표 행이 있으면 숫자(없으면 `—`). 진행 중인 달은 머리줄·칸에 구분 표시(옅은 테두리 + "진행").
- **합계 열**: 계획 = 12달 계획 합, 실적 = 완료+진행 달 실적 합. 배경색(실행률)은 **합계 열에 안 칠한다** — 연간 계획 대 누적 실적이라 비율이 늘 낮게 보여 오해를 산다.
- **실행률 배경색**: 계획 > 0이고 실적이 있는 달만. ≥100% 초록, 80~100% 무색, <80% 옅은 빨강. 계획 0·미래는 무색.
- **실패 화면**: 첫 로드 실패 → 표 자리에 "연간 실적을 불러오지 못했습니다"(`—`와 다른 모양). 갱신 실패 → 직전 표 유지 + 표 위 "갱신 실패 HH:MM(직전 값)" 한 줄. 목표(`?year=` config) 실패도 같은 처리(계획 칸을 0으로 그리지 않는다).

## 범위 밖

- 그래프 칸 → PR-5
- ERP 코드·nginx(ERP 쪽 gzip은 ERP 서버 설정 — 백로그)
- 연도 선택 UI, 끝난 달 캐시
- 관리자 목표 화면

## 파일 구조

| 파일 | 변경 | 책임 |
|---|---|---|
| `app/db/repos/monthly_progress.py` | Modify | `get_year_config(year)` — 12달 목표 행·계획외 지정을 한 번에 |
| `app/api/erp.py` | Modify | `monthly-progress-config?year=` / `monthly-kpi?year=` + `_normalize_year_kpi` |
| `main.py` | Modify | `GZipMiddleware` 추가 |
| `tests/test_erp_kpi_year.py` | Create | 중계 연간 정규화·상태코드 |
| `tests/test_monthly_target_rows.py` | Modify | `get_year_config` |
| `web/home.js` | Modify | ‹ › 삭제, 도넛 이번 달 고정, 연간 표 로더·렌더·접힘 기억 |
| `web/home.html` | Modify | 표 카드 마크업(‹ › 버튼 제거), 연간 표 CSS(sticky 머리줄·스크롤), `home.js?v=` 올림 |

---

## Task 0: 선행 확인 (코드 수정 없음)

- [ ] ERP 운영에 `?year=` 배포 확인: 대시보드 서버 `.env`의 `ERP_MONTHLY_KPI_URL`·키로 `curl -s -o /dev/null -w "%{http_code} %{size_download} %{time_total}\n" -H "Authorization: Bearer $KEY" "$URL?year=2026"` → 200, 약 164KB. **`time_total` 기록** — 중계 timeout(지금 10초)보다 여유가 있는지(5초 넘으면 중계 timeout을 20초로 올린다)
- [ ] `?year=2026&month=2026-11` → 400 확인(ERP가 거절)
- [ ] 브랜치: yjs_Dashboard `feat/home-yearly-table`

## Task 1: 목표 12달 한 번에 — `get_year_config`

**Files:** `app/db/repos/monthly_progress.py`, `app/api/erp.py`, `tests/test_monthly_target_rows.py`

- [ ] **실패 테스트 먼저**: 2026-01·2026-09에 목표 행, 2026-09에 계획외 지정 하나를 넣고 `repo.get_year_config("2026")`이
  ```python
  {"year": "2026",
   "months": [{"month": "2026-01", "targets": {"construction": [...], "settlement": [...]},
               "unplannedAssignments": [...]}, ... 12개],
   "managers": ["김상훈", ...]}
  ```
  를 돌려주는지. 행이 없는 달도 빈 배열로 12개 다 있는지. 다른 해(2025) 행이 섞이지 않는지.
- [ ] 구현: `monthly_target_rows WHERE month BETWEEN '{y}-01' AND '{y}-12'` 한 쿼리 + 계획외 지정도 한 쿼리, 파이썬에서 월별로 나눈다. 행 모양은 `list_target_rows`와 **같은 함수로** 만든다(행 dict 생성부를 `_target_row(r)`로 뽑아 둘이 공유 — 모양이 갈라질 자리를 없앤다). `total_progress`·`label`은 넣지 않는다(도넛 전용).
- [ ] 라우트: `get_monthly_progress_config(month="", year="")` — `year`와 `month`가 같이 오면 400, `year`가 `^\d{4}$`가 아니면 400, `year`면 `get_year_config`. 기존 `month` 동작 무변경.
- [ ] `pytest tests/test_monthly_target_rows.py` 통과

## Task 2: 중계 `monthly-kpi?year=`

**Files:** `app/api/erp.py`, `tests/test_erp_kpi_year.py`

- [ ] **실패 테스트 먼저**(기존 `test_erp_kpi_month.py`의 httpx 가짜 응답 방식을 그대로 따른다):
  1. 정상 12달(1~10월 완료, 11월 진행중, 12월 미래 `split: null`) → 200, `months` 12개, 각 `상태` 통과, 미래 `split is None`, 완료 달 split은 `_normalize_split` 결과와 같음, `year == "2026"`
  2. `month`와 `year` 같이 → 400(ERP 안 부름)
  3. `year=26` → 400
  4. ERP 400 → 400(본문 error 통과)
  5. ERP 500 → 503
  6. 계약 위반 → 503: months 11개 / 달 순서 어긋남 / `상태`가 셋 밖 / 완료·진행 달인데 `split: null` 또는 `split.construction` 없음 / `split.month`가 그 원소의 `month`와 다름 / 미래 달인데 split이 있음
- [ ] 구현 `_normalize_year_kpi(payload, year)`:
  - `payload.year == int(year)` 또는 문자열 일치, `months`가 길이 12 리스트, i번째 `month == f"{year}-{i+1:02d}"`
  - `상태 ∈ {"완료","진행중","미래"}`(허용목록 — 여기 적지 않으면 브라우저에 안 간다)
  - 미래: `split` 반드시 None으로 내보낸다. 완료·진행중: 기존 `_normalize_split` + `_normalize_month_kpi`와 같은 검사(달 일치·시공 칸 존재) — 검사 코드를 `_check_month_split(split, month)`로 뽑아 month 경로와 공유
  - 반환 `{"status":"success","year":year,"months":[{"month","상태","split"}...]}`
  - 주석: "미래의 null(약속된 빈 칸)과 실패(500→503)를 섞지 않는다 — null+200으로 실패를 감추지 않는다(11/10 결정)"
- [ ] 라우트 `get_monthly_kpi(month="", year="")`: 둘 다 → 400, `year`면 `params={"year": year}`, ERP 400 통과 조건을 `if (month or year) and status==400`으로. timeout은 Task 0 실측대로.
- [ ] `pytest` 전체 통과(기존 month·split 테스트 회귀 포함)

## Task 3: GZip (브라우저 구간)

**Files:** `main.py`

- [ ] `from starlette.middleware.gzip import GZipMiddleware`; `app.add_middleware(GZipMiddleware, minimum_size=1024)`. 주석: "연간 응답 약 164KB를 5분마다 받는다 — ERP→중계 구간은 ERP nginx 설정이라 범위 밖, 여기선 중계→브라우저만 줄인다"
- [ ] 확인: 로컬에서 `curl -s -H "Accept-Encoding: gzip" -D - -o /dev/null` 로 `/api/erp/monthly-kpi?year=2026`(세션 쿠키 필요 — 브라우저 네트워크 탭으로 대신해도 됨) `content-encoding: gzip`과 전송 크기 기록
- [ ] 미들웨어 순서 주의: `AccessLogMiddleware`가 응답 크기를 찍는다면 압축 전/후 어느 쪽이 찍히는지 한 줄 확인해 기록(운영지표 집계가 바이트를 쓰는지 — 안 쓰면 무시)

## Task 4: ‹ › 삭제, 도넛은 이번 달 고정

**Files:** `web/home.js`, `web/home.html`

- [ ] 삭제: `MIN_PLAN_MONTH`, `monthNavState`, `VIEW_RETURN_MS`, `goPlanActualMonth`, `shiftMonth`(다른 사용처 없을 때), `planActualPrev/Next` 버튼과 핸들러, `loadTotalProgressHome`의 `?month=` 분기·순번(seq) 처리. `monthNavState.loading/actualError`를 읽던 곳(도넛 캡션·담당자 칸·`'불러오는 중…'` 문구 129/145/216/688/707줄 근처)은 **이번 달 전용 상태 하나**(`totalProgressState.loadError` 등 기존 상태)로 정리
- [ ] `loadTotalProgressHome` = month 없는 KPI 1회 + `monthly-progress-config?month=<split.month>` 1회. 60초 `setInterval` 유지
- [ ] grep으로 남은 참조 0개 확인: `grep -n "monthNavState\|goPlanActualMonth\|MIN_PLAN_MONTH\|planActualPrev\|planActualNext" web/`
- [ ] `node --check web/home.js`
- [ ] 브라우저: 도넛·담당자 칸이 PR-3 배포판과 같은 숫자인지(11월 기준) 대조

## Task 5: 연간 데이터 로더

**Files:** `web/home.js`

- [ ] 상태: `const yearTableState = { year: '', months: null, config: null, error: '', staleSince: '', seq: 0 };`
- [ ] `loadYearTableHome()`:
  1. `year = (totalProgressState.erpMonth || '').slice(0,4)` — 비면 return(도넛 로드가 연도를 정한 뒤 부른다)
  2. `seq` 증가 후 `Promise.all([fetch('/api/erp/monthly-kpi?year='+year), fetch('/api/erp/monthly-progress-config?year='+year)])` — **둘 다 성공해야** 적용(계획만 새것·실적은 옛것인 반쪽 화면 금지). 늦게 온 응답은 seq로 버린다
  3. 실패: 직전 데이터가 있으면 유지 + `staleSince = HH:MM`, 없으면 `error`
  4. 성공: 상태 갱신 후 `renderYearTableHome()`
- [ ] 첫 호출: 도넛 첫 로드 완료 직후 1회. 이후 `setInterval(loadYearTableHome, 5 * 60 * 1000)` — 주석에 Q5 근거
- [ ] 주의: 도넛 60초 갱신이 `renderYearTableHome`을 부르지 않는다(표는 5분 데이터로만 다시 그린다 — 접힘 클릭 때만 예외로 재렌더)

## Task 6: 칸 계산 (순수 함수)

**Files:** `web/home.js`

- [ ] `buildYearGrid(kpiMonths, configMonths, managers)` → `{ construction: Kind, settlement: Kind }`, `Kind = { rows: [{ name, cells[12]: {plan, actual, 상태}, totalPlan, totalActual }], total: {...같은 모양} }`
  - 달마다: `target = normalizeTargets(configMonth.targets)`(kind별), `actual = 미래 ? null : normalizeBreakdown(split.construction)` / `normalizeSettlement(split.settlement)`, `unplannedOwner = new Map(configMonth.unplannedAssignments...)`(기존 홈과 같은 변환), `buildManagerProgress(target, actual, unplannedOwner)`
  - 행 순서: `managers` 목록 순 → 목록 밖 이름(가나다) → **맨 아래 "담당 미지정"** = 버킷 `''` + `unplannedRows`
  - `total` 행은 **담당 행들의 합으로 만든다**(달마다 `sumThousand`). 그리고 달마다 `normalize*`의 `totalThousand`와 같아야 한다 — 다르면 `console.warn('[yearTable] 담당 합 ≠ 합계', month, kind)` (대조는 화면이 아니라 개발자용 흔적)
  - 미래 달: `actual: null`(→ `—`). 계획이 0행이면 `plan: null`(→ `—`), 행이 있으면 합계
- [ ] 손 검산 1회: 11월 시공 칸의 담당별 실적이 지금 도넛 아래 담당자 칸 숫자와 천원까지 같은지(같은 함수·같은 재료이므로 같아야 한다)

## Task 7: 렌더·접힘 기억

**Files:** `web/home.js`, `web/home.html`

- [ ] `renderYearTableHome()` → `#planActualBody`(기존 id 재사용 — PR-3 Q2 교훈: id가 어긋나면 '불러오는 중…'이 영원히 남는다)
  - 머리줄: `구분 | 1월 … 12월 | 합계`, 진행 중인 달에 `진행` 표시
  - 접힘(기본): `시공 합계`·`정산 합계` 두 행(각 칸 계획 위/실적 아래) — 행 머리에 `▸`/`▾` 버튼
  - 펼침: 그 kind의 담당 행들 + 담당 미지정 + 합계
  - 칸 숫자 = `Math.round(thousand / 1000).toLocaleString()`(백만원), `title`에 천원 값. `null` → `—`
  - 실행률 배경색: 위 부수 결정 기준. 클래스로(`.pa-good`/`.pa-low`) — 인라인 스타일 금지
  - 단위 표기 "(단위: 백만원)" 표 위 한 줄
- [ ] 접힘 기억: 키 `home.yearTable.open.construction` / `.settlement`, 값 `'1'`. 읽기·쓰기 모두 `try { localStorage... } catch (e) {}` — 실패하면 접힘. 5분·60초 갱신은 이 값을 건드리지 않는다
- [ ] 에러·낡음 표시: `error` → 표 대신 문구, `staleSince` → 표 위 "갱신 실패 HH:MM(직전 값)"
- [ ] CSS(`home.html`): `.home-table-slot{overflow:auto}` 유지, 머리줄 `position:sticky; top:0`, 첫 열 `position:sticky; left:0`(배경색 필수), 기존 월 표 전용 `.pa-table` 규칙 중 안 쓰는 것 삭제, ‹ › 버튼 마크업 삭제
- [ ] `home.js?v=` 올림(캐시 사고 10/12·11/12 PR-3 Q1)
- [ ] `node --check web/home.js`

## Task 8: 검증

- [ ] `pytest` 전체
- [ ] 1600×900 브라우저 실측(로컬 서버 + 운영 ERP 키 또는 운영 배포 후):
  - 접힘 4줄이 표 칸 안에 스크롤 없이 들어감
  - 시공 펼침·정산 펼침·둘 다 펼침에서 머리줄 고정 + 표 칸 안에서만 스크롤, 페이지 전체 스크롤 없음
  - 펼친 채 새로고침 → 그대로 펼침 / 시크릿 창 → 접힘
  - 12월 실적 `—`, 11월 진행 표시, 1~10월 숫자
  - 담당 행 합 = 합계 행(콘솔 경고 0건)
  - 네트워크 탭: `monthly-kpi?year=` 5분 간격, gzip 전송 크기, 도넛 60초 호출은 그대로
  - 개발자 도구로 `?year=` 응답을 막았을 때(Block request URL) 첫 로드 문구 / 갱신 실패 문구 각각 확인
- [ ] 9월 '담당 미지정' 계획(목표 행 56개 미지정)이 미지정 줄에 몰려 보이는지 확인 → 사장님 보고 전 채울지 조성현 판단(§5-3)

## 게이트 4 질문 후보 (구현 세션에서 1~2개)

1. (조용한 실패) 중계 `_normalize_year_kpi`에 `상태` 허용목록 줄을 빼먹으면 브라우저는 무엇을 받고, 표에 무엇이 어떤 모양으로 찍히나 — 경고는 어디에 남나
2. (캐시 낡음/방아쇠) 사장님이 ERP에서 10월 담당을 고친 뒤 홈 표가 바뀌는 방아쇠는 무엇이고, 최대 몇 분 뒤인가 — 새로고침하면 당장 바뀌나
3. (같은 원본) 11월 시공 칸 숫자와 도넛 아래 담당자 칸 숫자가 같다는 걸 무엇이 보장하나 — 원본·함수·기간으로 나눠

## 진행 방식

- 기획 세션(2026-11-12)은 이 문서까지. **커밋하지 않았다.**
- 구현 세션: 위 Task 순서대로, 게이트 2~5. 커밋에 **이 계획 문서(yjs_erp)도 함께**(앞 PR들과 같은 방식 — yjs_erp 쪽은 별도 커밋), 세션 보고서는 구현 세션 끝에.
- 배포는 조성현 수동. ERP는 이미 배포돼 있으므로 대시보드만.

## 구현 결과 (2026-11-13, 구현 세션)

- Task 0 실측: 운영 ERP `?year=2026` 200 · 164,783B · 0.19~0.37초(3회) → 중계 timeout 10초 유지. `year&month` → 400. ERP는 gzip 미적용(요청해도 원본).
- GZip: 중계→브라우저 138,765B → 19,118B. 액세스 로그는 바이트를 안 찍어 미들웨어 순서 영향 없음.
- 계획과 달라진 것:
  1. 합계 행을 그 종류 **맨 위**에 둔다 — 접힘 단추를 겸해 펼쳐도 단추 자리가 안 움직이게.
  2. 미래 달에 split이 오면 **503**(계약 위반) — Task 2 본문("None으로 내보낸다")과 테스트 목록이 달라 엄격한 쪽.
  3. 연간 표 칸은 상세 팝업을 열지 않는다(설계에 요구 없음).
  4. 게이트 3 수용: 칸 계산 예외 → 실패 화면(try/catch), 실적을 못 받은 달은 표 위 한 줄("10월 정산을 불러오지 못함") — 칸의 `!`는 전자칠판에서 마우스로 설명을 못 본다.
- 1600×900 실측(로컬 서버 + 운영 ERP, 목표는 사본 DB 시험 행): 접힘 4줄 무스크롤 / 둘 다 펼침 시 페이지 900 유지·본문만 스크롤·머리줄 고정 / 펼침 기억·저장소 비우면 접힘 / 12달×2종류 표 합계 = ERP `totalThousand` 전부 일치 / 11월 담당별 = 도넛 담당자 칸 천원까지 일치 / 타이머 300,000·60,000ms, 60초 갱신은 `?year=` 안 부름 / 첫 로드 실패·갱신 실패 문구 확인.
- 미확인: 운영 9월 '담당 미지정' 목표 56개 표시(배포 후), 실제 5분 대기 네트워크 실측(타이머 등록값으로 대신).
