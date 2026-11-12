# 대시보드 홈 레이아웃 재구성 (연간 PR-3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** yjs_Dashboard 홈(`web/home.html`·`web/home.js`)에서 자재 현황·진행중 공사 지도를 **카드와 로더째** 빼고, 날씨를 작은 카드로 줄이고, 바로가기를 왼쪽 세로 한 열로 옮겨, 1600×900 전자칠판에서 PR-4 연간 표가 들어갈 넓은 아래 칸을 만든다.

**Architecture:** 화면을 `[바로가기 세로열 170px | 오른쪽]`의 2열 CSS grid로 바꾸고, 오른쪽을 `위(도넛·담당자 + 날씨 소형) / 아래(표 칸)`로 나눈다. PR-4 전까지 아래 칸에는 **기존 월 계획/실적 표(‹ ›)를 그대로 옮겨** 둔다 → PR-3만 배포돼도 빈칸이 없다. 그래프 칸(PR-5)은 이번에 만들지 않는다. 자재·지도 JS는 숨기지 않고 삭제한다(설계 §3-4: 안 보이는 카드가 API·지오코딩을 계속 부르지 않게).

**Tech Stack:** 정적 HTML + Bootstrap 5.3 + 바닐라 JS(IIFE), FastAPI 서버(이번엔 수정 없음). JS 테스트 러너 없음 → 검증은 `node --check` + grep + 1600×900 브라우저 실측 + 기존 pytest 회귀.

- 설계: `yjs_erp/docs/superpowers/specs/2026-11-12-dashboard-yearly-plan-actual-design.md` §3-4, §4 PR-3, §5-2
- 대상 레포: **yjs_Dashboard** (이 문서만 yjs_erp에 둔다 — 앞 PR 문서들과 같은 자리)
- 티어: A (설계 표는 B였으나 조성현 지정. 게이트 1~5 적용)

---

## 게이트 1 결정 (2026-11-12, 기획 세션)

| 질문 | 결정 | 기각 |
|---|---|---|
| 배치 | **A안**: 왼쪽 세로열 바로가기 / 오른쪽 위 = 도넛·담당자 + 날씨 소형, 아래 = 표 칸(나중에 그래프 칸 추가) | B(바로가기 오른쪽) · C(3열 유지 — 우측 칸 약 400px라 14열 표가 안 들어감, §5-2와 충돌) |
| PR-3만 배포됐을 때 빈 자리 | **기존 월 표(‹ ›)를 아래 표 칸으로 옮겨 둔다.** 그래프 칸은 PR-5에서 만든다 | 자리표시 카드(전자칠판에 빈칸) · PR-4와 묶어 배포(배포 단위가 커짐) |
| 날씨 | **소형 카드로 축소**(아이콘·기온·상태·강수확률만). `/api/weather` 호출 유지 | 제거 · 크기 유지 |
| 선택 근거 | (조성현) "전자칠판에 빈칸이 안 보이게 하려고. 대신 표가 PR-4에서 다시 바뀜" — 대가: 월 표 자리·CSS(`.home-table-slot .pa-table`)를 PR-4가 다시 갈아엎는다(임시 작업이 버려짐) | |

## 범위 밖 (PR-4·5로 넘김 / 건드리지 않음)

- 연간 표 자체, 접힘·기억, 계획외 줄, `—` 표시, 중계 허용목록에 `year`·`상태` 추가, 미래 null vs 500 구분, gzip·60초 폴링 여부 → **PR-4**
- 그래프 칸 → **PR-5**
- 도넛·‹ › 달 이동의 존폐(설계 §5-1) → **PR-4**. 이번엔 도넛·담당자·월 표 동작을 **한 줄도 바꾸지 않는다**(위치·크기만)
- 서버 라우트 `/api/erp/materials`, `/api/progress-sites`, `/api/public-config`는 **남긴다** — `map-admin.html`(`map-admin.js`)이 `/api/progress-sites`를 쓰고, 자재 라우트 제거는 별도 판단(백로그)
- ERP 코드, nginx 설정

## 파일 구조

| 파일 | 변경 | 책임 |
|---|---|---|
| `web/home.js` | Modify | 자재·지도 섹션·상수·호출 삭제. 그 외 로직 무변경 |
| `web/home.html` | Modify | `<main>` 마크업 재배치, 자재·지도 CSS·탭 인라인 스크립트 삭제, 새 grid·날씨 소형·바로가기 세로 CSS 추가, `home.js?v=` 올림 |

---

### Task 0: 브랜치

- [ ] **Step 1: 최신 main에서 브랜치**

```bash
cd ~/Documents/GitHub/yjs_Dashboard
git checkout main && git pull
git checkout -b feat/home-layout-yearly
```

주의: 작업 트리에 이미 `.claude/settings.local.json` 수정·`uploads/2026-05-10_백업데이터.xlsx` 삭제가 떠 있다(이번 작업과 무관). **커밋 때 `git add` 대상에 넣지 않는다.**

---

### Task 1: home.js — 자재·지도 코드 삭제

**Files:** Modify `web/home.js`

- [ ] **Step 1: 지우기 전 기준선 기록** (삭제 후 대조용)

```bash
grep -c "" web/home.js            # 현재 1688
grep -n "loadMaterialsHome\|initMapHome\|kakao\|ERP_MATERIALS_API\|progress-sites" web/home.js
```

- [ ] **Step 2: 섹션 한 덩어리 삭제**

`// ═══════════════════════════ 자재 현황 (ERP 실시간) ═══════════════════════════` 줄(현재 1106)부터 `// ═══════════════════════════ 현장 날씨 ═══════════════════════════` 줄 **바로 앞**(현재 1513)까지 삭제한다. 자재 섹션 → 지도 섹션이 연속이라 한 블록이다. 날씨 섹션 헤더는 남긴다.

삭제 범위 안에 있는 함수(전부 이 블록 밖에서 안 쓰임을 Step 5에서 확인): `matStatTile` `matCableChip` `matCableBars` `matCableLine` `renderMaterials` `setMaterialsError` `loadMaterialsHome` `setMapPlaceholder` `buildGeocodeQueries` `buildQueriesForItem` `loadProgressSites` `loadGeoCache` …(지오캐시 저장) `geocodeQueries` `closeActiveTooltip` `openTooltip` `loadKakaoSdk` `renderProgressMap` `fetchPublicConfig` `initMapHome`, 변수 `materialsEverLoaded`.

- [ ] **Step 3: 파일 위쪽 상수 정리**

(a) 1~8줄 머리 주석과 상수:

```js
    // ═══════════════════════════════════════════════════════════════════════
    //  연동 키 (사용자 발급 후 입력) ─ 이 두 값만 채우면 지도/날씨가 동작합니다.
    // ───────────────────────────────────────────────────────────────────────
    //  카카오맵 JS 키는 서버 .env(KAKAO_MAP_JS_KEY)에 두고 `/api/public-config`로 받아온다.
    //    (도메인 제한이 걸린 공개 키이지만 코드/깃에 하드코딩하지 않기 위함)
    //  WEATHER_API_BASE: 날씨는 CORS/키 보호를 위해 백엔드 프록시(`/api/weather/current`) 경유.
    //    백엔드 엔드포인트가 준비되면 자동으로 실데이터가 표시됩니다.
    const WEATHER_API_BASE = '/api/weather/current';
    const ERP_MONTHLY_KPI_API = '/api/erp/monthly-kpi';
    const ERP_MATERIALS_API = '/api/erp/materials';
```

를 다음으로 바꾼다:

```js
    // ═══════════════════════════════════════════════════════════════════════
    //  연동 주소
    // ───────────────────────────────────────────────────────────────────────
    //  WEATHER_API_BASE: 날씨는 CORS/키 보호를 위해 백엔드 프록시(`/api/weather/current`) 경유.
    //  자재 현황·진행중 공사 지도는 2026-11-12 홈에서 제거(연간 PR-3) — 연간 표 자리를 만들고,
    //  안 보이는 카드가 ERP 자재 API·카카오 지오코딩을 60초마다 계속 부르지 않게 로더째 뺐다.
    const WEATHER_API_BASE = '/api/weather/current';
    const ERP_MONTHLY_KPI_API = '/api/erp/monthly-kpi';
```

(b) `let kakaoMapJsKey = ''; // /api/public-config에서 런타임 주입` 한 줄 삭제.

(c) 다음 블록 삭제:

```js
    // ─── 지도 핀 데이터 소스 ────────────────────────────────────────────────
    // 서버 `/api/progress-sites`(data/progress_sites.json)에서 받아온다.
    // 위치는 다음 우선순위로 결정: ① lat/lng(관리 페이지에서 핀 고정) → ② addr(주소 지오코딩)
    //   → ③ 공사명에서 자동 추출(폴백). 관리 화면: /map-admin.html
    let MONTHLY_PROGRESS_DATA = [];
```

(d) 다음 블록 삭제:

```js
    // 안양시청 부근 — 키워드 검색 위치 보정 / 지도 초기 중심
    const ANYANG_CENTER = { lat: 37.3943, lng: 126.9568 };
    const GEO_CACHE_KEY = 'yjs_geo_cache_v1';

    let mapInstance = null;
    let activeTooltipOverlay = null;
```

(e) **남긴다:** `MANAGER_STYLE`·`DEFAULT_MANAGER_STYLE`·`EXTRA_MANAGER_COLORS`·`managerStyle()` — 담당자별 진척 그래프가 쓴다. 주석 `// 담당자별 핀 색상/약칭`만 `// 담당자별 색상/약칭 (담당자별 진척 그래프)`로 고친다.

- [ ] **Step 4: 초기화·폴링 호출 삭제** (`initializeHomePage`)

```js
        renderTotalProgressChartHome();
        loadTotalProgressHome();
        loadMaterialsHome();
        renderWeatherPlaceholder();
        initMapHome();
        await Promise.all([loadFrequentSitesHome(), loadWeatherHome()]);
        setInterval(() => {
            updateNowLabel();
            loadTotalProgressHome();
            loadMaterialsHome();
            loadFrequentSitesHome();
            loadWeatherHome();
        }, 60000);
```

→

```js
        renderTotalProgressChartHome();
        loadTotalProgressHome();
        renderWeatherPlaceholder();
        await Promise.all([loadFrequentSitesHome(), loadWeatherHome()]);
        setInterval(() => {
            updateNowLabel();
            loadTotalProgressHome();
            loadFrequentSitesHome();
            loadWeatherHome();
        }, 60000);
```

- [ ] **Step 5: 남은 참조 0건 확인 + 문법 검사**

```bash
grep -n "loadMaterialsHome\|renderMaterials\|materialsEverLoaded\|ERP_MATERIALS_API\|initMapHome\|kakao\|mapInstance\|activeTooltipOverlay\|ANYANG_CENTER\|GEO_CACHE_KEY\|MONTHLY_PROGRESS_DATA\|progress-sites\|setMapPlaceholder\|matCable\|matEtc" web/home.js
node --check web/home.js
```

Expected: grep 출력 **없음**, `node --check` 출력 없음(종료코드 0). grep에 걸리면 Step 2 범위를 다시 본다.

---

### Task 2: home.html — 마크업 재배치

**Files:** Modify `web/home.html` (`<main class="home-shell">` … `</main>`, 현재 915~1071)

- [ ] **Step 1: `<main>` 전체를 아래로 교체**

`<div id="planActualBody">` 등 **모든 id는 그대로** 둔다 — home.js가 id로 찾기 때문에 위치만 옮기면 동작이 안 바뀐다. 날씨에서 빠지는 id(`weatherWind`·`weatherHumidity`·`weatherForecast`·`weatherAlert`·`weatherDateBadge`)는 home.js가 전부 `if (el)`로 감싸 읽으므로 없어도 에러가 안 난다(`renderWeather`·`renderWeatherPlaceholder`·`updateNowLabel` 확인함).

```html
    <main class="home-shell">
        <!-- 2026-11-12 연간 PR-3: 1600×900 전자칠판 기준 재배치(설계 §3-4·§5-2).
             왼쪽 = 바로가기 세로 한 열, 오른쪽 위 = 총 공정률 + 날씨(소형), 오른쪽 아래 = 표 칸.
             표 칸은 PR-4에서 1~12월 표로 바뀐다 — 그때까지 기존 월 계획/실적 표(‹ ›)를 둔다.
             그래프 칸은 PR-5에서 표 칸 아래에 추가한다. -->
        <div class="home-grid">
            <!-- 왼쪽: 바로가기 세로 한 열 (id 유지로 home.js 렌더링 그대로 동작) -->
            <div class="home-card p-3 d-flex flex-column shortcut-col">
                <div class="section-title mb-2">바로가기</div>
                <div id="homeFrequentSiteList" class="mini-link-grid">
                    <div class="text-muted small">불러오는 중...</div>
                </div>
            </div>

            <div class="home-right">
                <!-- 오른쪽 위: 총 공정률(전체 + 담당자별) + 현장 날씨(소형) -->
                <div class="home-top">
                    <!-- 총 공정률 — 왼쪽 = 전체 도넛, 오른쪽 = 담당자별 진척(home.js renderManagerProgressHome) -->
                    <div class="home-card p-3 d-flex flex-column home-top-main">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <div id="totalProgressTitle" class="section-title">6월 총 공정률</div>
                            <span class="badge text-bg-light border">목표 대비</span>
                        </div>
                        <div class="tp-split">
                            <div class="tp-split-donut">
                                <div id="totalProgressDonut" class="total-progress-donut no-settle">
                                    <div id="totalProgressInner" class="total-progress-inner"></div>
                                    <div class="total-progress-center">
                                        <div class="tp-center-row"><span class="k">시공</span><span id="totalProgressValue" class="total-progress-value">-</span></div>
                                        <div class="tp-center-row" id="totalProgressSettleRow"><span class="k">정산</span><span id="totalProgressSettleValue" class="total-progress-settle">-</span></div>
                                    </div>
                                </div>
                                <div class="total-progress-legend">
                                    <span><i class="dot-chip construction"></i>바깥 시공</span>
                                    <span id="totalProgressLegendSettle"><i class="dot-chip settlement"></i>안쪽 정산</span>
                                </div>
                                <div id="totalProgressAmount" class="total-progress-caption" style="margin-top:6px;font-weight:700;color:#1f3045;font-size:0.84rem;line-height:1.6;"></div>
                            </div>
                            <div class="tp-split-managers">
                                <div class="mgr-head">
                                    <span class="fw-bold">담당자별 진척</span>
                                    <span class="mgr-legend"><i class="dot-chip construction"></i>시공 <i class="dot-chip settlement"></i>정산</span>
                                </div>
                                <div id="managerProgressList" class="mgr-scroll">
                                    <div class="text-muted small">불러오는 중...</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 현장 날씨(소형) — 2026-11-12 축소: 예보·바람·습도·특보 줄 제거, /api/weather 호출은 그대로 -->
                    <div class="home-card p-3 d-flex flex-column weather-mini">
                        <div class="section-title mb-2">날씨 · <span id="weatherCity">안양</span></div>
                        <div class="weather-now">
                            <div class="weather-icon" id="weatherIcon">⛅</div>
                            <div class="weather-temp" id="weatherTemp">--°</div>
                        </div>
                        <div class="weather-cond" id="weatherCond">날씨 정보 연동 대기</div>
                        <div class="weather-cond">강수확률 <b id="weatherPop">--</b></div>
                    </div>
                </div>

                <!-- 오른쪽 아래: 표 칸 — PR-4 전까지 기존 월 계획/실적 표(2026-11-10).
                     ‹ › 는 표만이 아니라 도넛·담당자 그래프·상세 팝업을 같은 달로 함께 옮긴다(동작 무변경) -->
                <div class="home-card p-3 d-flex flex-column home-table-slot">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <div class="section-title">계획 / 실적</div>
                        <div class="pa-nav">
                            <button type="button" id="planActualPrev" class="pa-nav-btn" aria-label="이전 달" disabled>‹</button>
                            <span id="planActualMonth" class="pa-nav-month">-</span>
                            <button type="button" id="planActualNext" class="pa-nav-btn" aria-label="다음 달" disabled>›</button>
                        </div>
                    </div>
                    <div id="planActualPeriod" class="pa-period">단위 천원</div>
                    <div id="planActualBody" class="pa-table">
                        <div class="text-muted small" style="grid-column: 1 / -1; text-align: left;">불러오는 중...</div>
                    </div>
                    <div id="planActualNotice" class="pa-notice" style="display:none;"></div>
                </div>
            </div>
        </div>
    </main>
```

- [ ] **Step 2: 자재 탭 인라인 스크립트 삭제**

`<script>` `// 자재 현황 — 케이블/기타 자재 탭 전환 (정적 목업 전용이라 home.js 대신 인라인)` … `</script>` 블록(현재 1144~1156)을 통째로 지운다. (`.mat-seg`가 없어 `if (!seg) return;`으로 무해하긴 하지만 죽은 코드다.)

- [ ] **Step 3: 캐시 열쇠 올리기**

```html
    <script src="/home.js?v=20261110a"></script>
```
→
```html
    <script src="/home.js?v=20261112a"></script>
```

이유(보강 로그 '캐시 낡음' 2026-10-12): 새 html + 브라우저 캐시의 옛 home.js가 만나면 옛 js가 `loadMaterialsHome()`·`initMapHome()`을 계속 부른다(요소가 없어 화면엔 안 보이고 네트워크만 탐 — 에러 없이).

---

### Task 3: home.html — CSS 정리·추가

**Files:** Modify `web/home.html` `<style>`

- [ ] **Step 1: 옛 3열 높이 규칙 교체**

```css
        .home-row {
            height: 100%;
        }

        .home-row > [class^="col"] {
            height: 100%;
        }
```
→
```css
        /* ── 홈 배치 (2026-11-12 연간 PR-3, 1600×900 기준) ──
           왼쪽 바로가기 170px | 오른쪽(위: 공정률+날씨 / 아래: 표 칸).
           아래 칸이 더 큰 이유: PR-4 1~12월 표(접힘 4줄 → 펼침 약 13행)가 들어올 자리 */
        .home-grid {
            display: grid;
            grid-template-columns: 170px minmax(0, 1fr);
            gap: 8px;
            height: 100%;
        }
        .home-right {
            display: grid;
            grid-template-rows: minmax(0, 46fr) minmax(0, 54fr);
            gap: 8px;
            min-height: 0;
        }
        .home-top {
            display: flex;
            gap: 8px;
            min-height: 0;
        }
        .home-top-main { flex: 1 1 auto; min-width: 0; min-height: 0; }
        .home-table-slot { min-height: 0; overflow: auto; }
        /* 월 표(임시)가 넓은 칸에서 1400px로 늘어나 숫자가 멀어지지 않게 */
        .home-table-slot .pa-table { max-width: 640px; }

        /* 바로가기 세로 한 열 — 아이콘 + 이름 가로 한 줄 */
        .shortcut-col { min-height: 0; }
        .shortcut-col .mini-link-grid { grid-template-columns: 1fr; gap: 6px; }
        .shortcut-col .mini-link {
            display: flex; align-items: center; gap: 8px;
            text-align: left; padding: 7px 10px; font-size: 0.8rem;
        }
        .shortcut-col .mini-link-favicon,
        .shortcut-col .mini-link-icon-fallback { margin: 0; flex: 0 0 auto; }

        /* 날씨 소형 */
        .weather-mini { flex: 0 0 180px; min-height: 0; }
        .weather-mini .weather-now { gap: 8px; margin-bottom: 4px; }
```

(`.weather-now`의 기존 속성은 143줄에 그대로 있다 — 위는 덮어쓰기만.)

- [ ] **Step 2: 죽은 CSS 삭제** — 아래 선택자 블록을 전부 지운다(전부 Task 2에서 지운 마크업 전용):

  - 지도: `.map-card-body` `#progressMap` `.map-legend`(하위 포함) `.map-placeholder`(`.ph-icon`·`.d-none` 포함) `.map-tip`(`::after`·`-close`·`:hover` 포함), `.legend-dot`가 있으면 그것도
  - 자재: `.mat-narrow …` 4줄, `/* ── 자재 현황 …` 주석부터 `.mat-seg` `.mat-tab` `.cable-*` `.etc-*` `.cable-foot`까지
  - 날씨 중 안 쓰게 된 것: `.weather-meta` `.weather-chip`(`b` 포함) `.weather-forecast`(하위 `.wf-day` 등 포함) `.weather-alert`
  - `@media (max-width: 1200px), (max-height: 720px)` 안의 `.map-card-body {…}`, `/* 좁은 화면: 케이블 … */` 주석, `.cable-cols {…}`, `.etc-grid {…}` 줄

- [ ] **Step 3: 좁은 화면 폴백 교체** (`@media (max-width: 1200px), (max-height: 720px)` 안)

```css
            .home-row, .home-row > [class^="col"] { height: auto; }
```
→
```css
            /* 좁은 화면: 한 열로 쌓고 세로 스크롤 */
            .home-grid { grid-template-columns: 1fr; height: auto; }
            .home-right { grid-template-rows: auto auto; }
            .home-top { flex-direction: column; }
            .weather-mini { flex: 0 0 auto; }
            .shortcut-col .mini-link-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
```

- [ ] **Step 4: 남은 참조 0건 확인**

```bash
grep -n "home-row\|map-\|progressMap\|mat-\|cable-\|etc-\|weather-forecast\|weather-chip\|weather-meta\|weather-alert\|wf-day\|legend-dot" web/home.html
```

Expected: 출력 없음. (주의: `mgr-`·`tp-`·`pa-`는 대상 아님.)

---

### Task 4: 회귀 + 브라우저 실측

- [ ] **Step 1: 서버 테스트 회귀** (서버는 안 바꿨지만 smoke가 홈 HTML을 서빙함)

```bash
python -m pytest tests -q
```
Expected: 전부 PASS (기존과 같은 개수).

- [ ] **Step 2: 로컬 실행 후 1600×900 실측**

```bash
python main.py
```
브라우저 창 1600×900(개발자도구 기기 모드 "Responsive" 1600×900)에서 `/home.html` 로그인 후 확인:

| # | 확인 | 기대 |
|---|---|---|
| 1 | 바로가기 | 왼쪽 세로 한 열, 운영 기준 9개가 스크롤 없이 보임 |
| 2 | 도넛·담당자 | 위 칸에 잘림 없이 그려짐, 담당자 목록은 자체 스크롤 |
| 3 | 날씨 | 위 칸 오른쪽 소형 카드, 기온·상태·강수확률 |
| 4 | 월 표 | 아래 칸, ‹ › 누르면 도넛 제목·담당자도 같은 달로 바뀜(11/10 동작 그대로) |
| 5 | 페이지 스크롤 | 1600×900에서 **페이지 전체 스크롤 없음** |
| 6 | 네트워크 탭(70초 이상 관찰) | `/api/erp/materials`·`/api/progress-sites`·`/api/public-config`·`dapi.kakao.com` **0건**. `monthly-kpi`·`weather`·바로가기는 60초마다 |
| 7 | 콘솔 | 에러 0건 |
| 8 | 1920×1080 | 깨짐 없음 |
| 9 | 1200 미만 폭 | 한 열로 쌓이고 세로 스크롤 |

- [ ] **Step 3: 강제 새로고침 없이** 한 번 더 열어 `home.js?v=20261112a`가 새로 받아졌는지 네트워크 탭에서 확인.

---

### Task 5: 게이트 3·4·5

- [ ] **게이트 3 리뷰** — 특히 볼 것: id 누락(옮기다 빠진 id가 있으면 해당 기능이 **에러 없이** 멈춤 — `getElementById`가 null이고 대부분 `if (el)`로 감싸여 있어서), 죽은 CSS 잔존, 1600×900 세로 넘침.
- [ ] **게이트 4** 후보 질문(1~2개, 보강 로그 겨냥):
  - (캐시 낡음) `?v=`를 안 올리고 배포했고 사장님 전자칠판이 옛 home.js를 들고 있다면, 화면엔 뭐가 보이고 네트워크엔 무슨 일이 일어나나? 누가 알아채나?
  - (조용한 절단 계열) `planActualBody` id를 옮기다 오타 냈다면 화면은? 왜 에러가 안 나나?
- [ ] **게이트 5 커밋** — 메시지는 조성현이 쓴다. `git add web/home.html web/home.js` + 이 계획 문서는 yjs_erp 쪽이므로 따로(yjs_erp 문서 커밋은 PR-4 기획 문서와 함께 또는 별도 docs 커밋).
- [ ] PR 생성 → 머지. 배포는 조성현 수동(ERP 변경 없음 → 대시보드만).

## 백로그 (이번에 안 함)

- 서버 `/api/erp/materials` 중계 라우트·ERP 자재 summary 프로듀서는 이제 홈에서 안 쓴다 — 다른 소비자가 없으면 제거 검토
- `KAKAO_MAP_JS_KEY`·`/api/public-config`를 홈 말고 쓰는 곳이 있는지(`map-admin.js`) 확인 후 정리 검토
