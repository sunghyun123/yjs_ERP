# 대시보드 홈 계획/실적 표 (PR-3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** yjs_Dashboard 홈의 외출/행선표 자리에 "월 ‹ › × {시공, 정산} × {계획, 실적, 실행률}" 표를 넣고, ‹ ›가 표·도넛·담당자 그래프·상세 팝업을 **같은 달로 함께** 움직이게 한다.

**Architecture:** 중계(`app/api/erp.py`)가 `?month=`를 ERP `/api/kpi/monthly-performance`로 넘기고 `{status, month, split}`만 돌려준다(ERP 400은 400 그대로, 나머지 실패는 503). `home.js`는 상태 한 벌(`totalProgressState`)을 유지하고, "보고 있는 달"(`monthNavState.viewMonth`)만 새로 둔다 — 표는 도넛과 같은 상태에서 그리므로 숫자가 갈라질 자리가 없다. 계산은 새로 만들지 않는다(`getTotalProgressPercent`·`getSettlementPercent`·`buildManagerProgress` 재사용).

**Tech Stack:** FastAPI + httpx(중계), pytest, 바닐라 JS(IIFE, 빌드 없음), Bootstrap 5.

**레포:** 이 계획의 코드는 전부 **yjs_Dashboard**(`C:\Users\조성현\Documents\GitHub\yjs_Dashboard`)에서 고친다. 이 문서만 yjs_erp에 있다. 브랜치 `feat/plan-actual-table`(yjs_Dashboard, main에서).

---

## 기획 세션 결정 (2026-11-10, 게이트 1)

| # | 결정 | 근거 |
|---|---|---|
| 1 | **A안**: 표는 외출/행선표 자리(왼쪽 위). 도넛·담당자 카드 그대로 | 사용자: "사장님이 원하는 건 데이터가 어디를 봐도 일치하는 것. 도넛은 사장님이 가장 좋아하는 UI" |
| 1-1 | ‹ ›는 표만이 아니라 **도넛·담당자 그래프·팝업도 같은 달로** 옮긴다(상태 한 벌) | 위와 같음. 표 실행률 = 도넛 %가 같은 배열에서 나오는 중복은 비용이 아니라 기능 |
| 1-2 | **자재 현황은 남긴다**. 빼는 건 외출/행선표뿐 | 사용자: 사장님 지시는 외출/행선표만(설계 §1-1의 "자재도 뺀다"는 오기 — 이번 세션에서 정정) |
| 2 | 중계: `month` 형식 검사 → ERP에 `params={"month"}` → 별도 정규화 `_normalize_month_kpi`. ERP 400 → 400 그대로, ERP 5xx·네트워크·계약 위반 → 503 | 기존 `_normalize_monthly_kpi`를 거치면 `updatedAt:""`가 붙어 화면에 "최신화 2026-06-18"(대체값 날짜)이 에러 없이 찍힌다 |
| 3 | ‹ › 오른쪽 끝 = month 없는 응답의 `split.month`(60초마다 갱신). 왼쪽 끝 = 상수 `'2026-09'` | 대시보드가 달 규칙을 다시 만들지 않는다(설계 §7-4). 왼쪽 끝이 어긋나면 ERP가 400을 주므로 조용히 틀어지지 않는다 |
| 4 | month 경로 실패 → 실적 '못 불러옴', 실행률 '—', 안내 줄, 도넛 '-'·캡션 '실적 불러오지 못함'. **0으로도 6월 대체값으로도 채우지 않는다.** 이번 달 경로의 기존 동작(대체값·마지막 값 유지)은 범위 밖 | 진짜 0(행 0개 → 0 / 0.0%)과 실패가 글자부터 달라야 한다 |
| 5 | 캐시 없음. 대신 (a) 지난 달을 보고 5분 지나면 이번 달로 복귀 (b) 늦게 도착한 응답은 버림(요청 순번) | month 호출 1회 비용 = 이미 60초마다 나가는 month 없는 호출과 같은 수준(둘 다 `load성과재료` 전체 읽기). 전자칠판에 지난 달이 하루 종일 떠 있으면 안 됨 |
| 6 | `home.html`·`home.js` 한 커밋, `home.js?v=` 올림. 외출/행선표는 카드·모달·CSS·JS·`window.*` 내보내기를 **같이** 지운다 | html/js 버전 섞임 방지. 인라인 onclick이 사라진 함수를 부르면 클릭마다 에러 |

**건드리지 않는 것:** `app/api/schedules.py`의 worker-status API와 `dashboard.html`/`dashboard.schedule.js`(일정 화면이 계속 씀), 자재·지도·날씨·바로가기, 이번 달 대체값 경로(백로그 B안), 관리자 화면.

## 파일 구조

| 파일 | 변경 | 책임 |
|---|---|---|
| `app/api/erp.py` | 수정 | `get_monthly_kpi`에 `month` 쿼리, `_normalize_month_kpi` 신설 |
| `tests/test_erp_kpi_month.py` | 생성 | 중계 month 경로 계약 테스트 |
| `web/home.html` | 수정 | 외출/행선표 카드 → 계획/실적 표 카드, 귀가시각 모달·worker CSS 제거, 표 CSS 추가, `?v=` |
| `web/home.js` | 수정 | 외출/행선표 코드 제거, 달 이동 상태·로더 재구성, 표 렌더 |

---

### Task 1: 중계 — `?month=` 전달과 `{status, month, split}` 정규화

**Files:**
- Modify: `app/api/erp.py` (`_normalize_monthly_kpi` 아래에 함수 추가, `get_monthly_kpi` 교체)
- Test: `tests/test_erp_kpi_month.py` (생성)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_erp_kpi_month.py`:

```python
"""
중계 month 경로 (2026-11-10, PR-3). ERP 계약은 yjs_erp PR #52:
  ?month=YYYY-MM → 200 { month, split } / 형식·범위 오류 400 { error } / split 실패 500 { error }
중계는 month 응답을 기존 정규화(_normalize_monthly_kpi)에 넣지 않는다 — 그 함수는 updatedAt:"" 등
'이번 달' 칸을 빈 값으로 붙여 보내고, 화면이 그 빈 값을 대체값 날짜(2026-06-18)로 그린다.
"""
import httpx

from app.core.config import settings
from tests.test_smoke_basic_flow import login_as_admin

URL = "https://erp.example.test/kpi"


def _split(month="2026-10"):
    return {
        "month": month, "from": "2026-09-28", "to": "2026-11-02",
        "construction": {"rows": [{"지중no": "JG26-041", "공사명": "안양", "금액천원": 100, "일자": [1], "야간일자": []}],
                         "totalThousand": 100},
        "settlement": {"rows": [], "totalThousand": 0},
    }


def _install_fake_erp(monkeypatch, status=200, body=None, calls=None):
    import app.api.erp as erp_api

    monkeypatch.setattr(settings, "ERP_MONTHLY_KPI_URL", URL)
    monkeypatch.setattr(settings, "ERP_DASHBOARD_API_KEY", "test-token")

    class _FakeAsyncClient:
        def __init__(self, timeout):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url, headers, params=None):
            if calls is not None:
                calls.append(params)
            return httpx.Response(status, json=body, request=httpx.Request("GET", url))

    monkeypatch.setattr(erp_api.httpx, "AsyncClient", _FakeAsyncClient)


def test_month는_세션이_필요하다(client):
    assert client.get("/api/erp/monthly-kpi?month=2026-10").status_code == 401


def test_month를_ERP로_넘기고_month_split만_돌려준다(client, monkeypatch, tmp_path):
    login_as_admin(client, monkeypatch, tmp_path)
    calls = []
    _install_fake_erp(monkeypatch, body={"month": "2026-10", "split": _split()}, calls=calls)

    res = client.get("/api/erp/monthly-kpi?month=2026-10")

    assert res.status_code == 200
    assert calls == [{"month": "2026-10"}]
    body = res.json()
    assert set(body.keys()) == {"status", "month", "split"}
    assert body["month"] == "2026-10"
    assert body["split"]["month"] == "2026-10"
    assert body["split"]["construction"]["totalThousand"] == 100


def test_month_없으면_params를_넘기지_않는다(client, monkeypatch, tmp_path):
    login_as_admin(client, monkeypatch, tmp_path)
    calls = []
    _install_fake_erp(monkeypatch, body={"label": "11월", "split": _split("2026-11")}, calls=calls)

    res = client.get("/api/erp/monthly-kpi")

    assert res.status_code == 200
    assert calls == [None]
    assert "amounts" in res.json()


def test_month_형식이_틀리면_ERP를_부르지_않고_400(client, monkeypatch, tmp_path):
    login_as_admin(client, monkeypatch, tmp_path)
    calls = []
    _install_fake_erp(monkeypatch, body={}, calls=calls)

    for bad in ["2026-9", "2026-13", "2026-10-01", "abc"]:
        assert client.get(f"/api/erp/monthly-kpi?month={bad}").status_code == 400
    assert calls == []


def test_ERP가_400이면_400과_ERP_문구를_그대로(client, monkeypatch, tmp_path):
    login_as_admin(client, monkeypatch, tmp_path)
    _install_fake_erp(monkeypatch, status=400, body={"error": "month 는 2026-09~2026-11 범위"})

    res = client.get("/api/erp/monthly-kpi?month=2026-08")

    assert res.status_code == 400
    assert res.json()["detail"] == "month 는 2026-09~2026-11 범위"


def test_ERP가_500이면_503(client, monkeypatch, tmp_path):
    login_as_admin(client, monkeypatch, tmp_path)
    _install_fake_erp(monkeypatch, status=500, body={"error": "boom"})

    assert client.get("/api/erp/monthly-kpi?month=2026-10").status_code == 503


def test_ERP가_다른_달을_돌려주면_503(client, monkeypatch, tmp_path):
    # 요청한 달과 다른 달을 그리면 '10월' 제목 아래 9월 숫자가 에러 없이 그려진다 — 계약 위반으로 본다
    login_as_admin(client, monkeypatch, tmp_path)
    _install_fake_erp(monkeypatch, body={"month": "2026-09", "split": _split("2026-09")})

    assert client.get("/api/erp/monthly-kpi?month=2026-10").status_code == 503


def test_split이_없으면_503(client, monkeypatch, tmp_path):
    login_as_admin(client, monkeypatch, tmp_path)
    _install_fake_erp(monkeypatch, body={"month": "2026-10", "split": None})

    assert client.get("/api/erp/monthly-kpi?month=2026-10").status_code == 503
```

- [ ] **Step 2: 실패 확인**

Run (yjs_Dashboard): `.venv\Scripts\python -m pytest tests/test_erp_kpi_month.py -q`
Expected: `test_month는_세션이_필요하다`만 PASS, 나머지 FAIL(200에 `amounts` 키가 있음 / params 미전달 / 400 대신 200 등). (`from tests.test_smoke_basic_flow import login_as_admin`은 `test_monthly_target_rows.py`·`test_upload_serving.py`가 이미 쓰는 방식이다.)

- [ ] **Step 3: 구현**

`app/api/erp.py` — `_normalize_monthly_kpi` 함수 바로 아래에 추가:

```python
# 'YYYY-MM' (01~12월). ERP 가 다시 검사하지만, 모양이 틀린 값은 ERP 를 부르기 전에 돌려보낸다
_MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


class _ErpContractError(ValueError):
    """ERP 가 200 으로 답했지만 약속한 모양이 아니다 — 화면엔 실패로 보여야 한다(503)."""


def _normalize_month_kpi(payload: Dict[str, Any], month: str) -> Dict[str, Any]:
    """
    ?month= 응답 { month, split } 전용 (2026-11-10, PR-3).
    _normalize_monthly_kpi 를 쓰지 않는다: 그 함수는 '이번 달' 칸(amounts·updatedAt)을 빈 값으로 붙여 보내고,
    home.js 는 빈 updatedAt 을 대체값 날짜(2026-06-18)로 그린다 — 지난 달 표에 6월 날짜가 에러 없이 찍힌다.
    요청한 달과 다른 달이 오면 계약 위반으로 본다(그대로 그리면 '10월' 제목 아래 9월 숫자).
    """
    split = _normalize_split(payload)
    if payload.get("month") != month or split is None or split.get("month") != month:
        raise _ErpContractError(f"ERP month 응답이 요청({month})과 다르다")
    return {"status": "success", "month": month, "split": split}


def _erp_error_text(response: "httpx.Response") -> str:
    try:
        body = response.json()
    except ValueError:
        return "ERP 가 요청한 달을 거절했습니다."
    if isinstance(body, dict) and isinstance(body.get("error"), str) and body["error"].strip():
        return body["error"].strip()
    return "ERP 가 요청한 달을 거절했습니다."
```

`get_monthly_kpi` 전체를 교체:

```python
@router.get("/monthly-kpi")
async def get_monthly_kpi(month: str = "", _session=Depends(require_session)):
    # month 가 비면 지금과 같은 응답(이번 달). 있으면 그 달의 { status, month, split } 만.
    month = (month or "").strip()
    if month and not _MONTH_RE.match(month):
        raise HTTPException(status_code=400, detail="month 는 YYYY-MM 형식이어야 합니다.")

    url = (settings.ERP_MONTHLY_KPI_URL or "").strip()
    token = (settings.ERP_DASHBOARD_API_KEY or "").strip()
    if not url or not token:
        raise HTTPException(status_code=503, detail="ERP KPI API is not configured.")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            headers = {"Authorization": f"Bearer {token}"}
            # month 없는 호출은 params 를 아예 넘기지 않는다(기존 호출 모양 그대로)
            response = (
                await client.get(url, headers=headers, params={"month": month})
                if month
                else await client.get(url, headers=headers)
            )
        # ERP 의 400 은 '요청한 쪽(범위 밖 달)' 잘못이다 — 503 으로 바꾸면 브라우저가 ERP 장애와 구분하지 못한다
        if month and response.status_code == 400:
            raise HTTPException(status_code=400, detail=_erp_error_text(response))
        response.raise_for_status()
        body = response.json()
        if not isinstance(body, dict):
            raise ValueError("ERP KPI API returned a non-object response.")
        return _normalize_month_kpi(body, month) if month else _normalize_monthly_kpi(body)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("ERP monthly KPI lookup failed (month=%s): %s", month or "-", exc)
        raise HTTPException(status_code=503, detail="ERP KPI data is unavailable.")
```

- [ ] **Step 4: 통과 확인 + 기존 테스트**

Run: `.venv\Scripts\python -m pytest tests/test_erp_kpi_month.py tests/test_erp_kpi_split.py tests/test_erp_kpi_breakdown.py tests/test_smoke_basic_flow.py -q`
Expected: 전부 PASS. 기존 `test_erp_monthly_kpi_proxy_returns_normalized_payload`의 가짜 `get(self, url, headers)`가 `params`를 안 받는데도 통과해야 한다(month 없는 호출은 params를 넘기지 않으므로) — 실패하면 month 없는 분기에 params가 섞인 것이다.

- [ ] **Step 5: 전체 테스트**

Run: `.venv\Scripts\python -m pytest -q`
Expected: 전부 PASS.

(커밋은 Task 4 뒤 사용자가 한다 — Task 1 커밋 메시지 초안만 남긴다: "중계가 ?month= 를 ERP 로 넘기고 그 달 split 만 돌려주게")

---

### Task 2: home.html — 외출/행선표 카드를 계획/실적 표 카드로

**Files:**
- Modify: `web/home.html`

- [ ] **Step 1: 외출/행선표 카드 교체**

`<!-- 좌: 외출/행선표 + 현장 날씨 -->` 주석을 `<!-- 좌: 계획/실적 표 + 현장 날씨 -->`로 바꾸고, `<!-- 외출/행선표 -->`부터 `id="workerStatusListHome"`를 감싼 카드의 닫는 `</div>`까지(현재 999~1014줄)를 아래로 교체한다:

```html
                    <!-- 계획/실적 표 (2026-11-10, 설계 §6 PR-3) — 외출/행선표 자리. 도넛·담당자 그래프와 같은 상태에서 그린다(home.js renderPlanActualTableHome).
                         ‹ › 는 표만이 아니라 도넛·담당자 그래프·상세 팝업을 같은 달로 함께 옮긴다 — "어디를 봐도 같은 숫자" -->
                    <div class="home-card p-3 d-flex flex-column" style="flex: 1 1 56%; min-height: 0;">
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
                            <div class="text-muted small">불러오는 중...</div>
                        </div>
                        <div id="planActualNotice" class="pa-notice" style="display:none;"></div>
                    </div>
```

- [ ] **Step 2: 귀가시각 모달 삭제**

`<div class="modal fade" id="workerReturnTimeModal"` 로 시작하는 블록 전체(현재 1202~1231줄, 닫는 `</div>` 네 겹까지)를 지운다.

- [ ] **Step 3: worker CSS 삭제, 표 CSS 추가**

`<style>` 안에서 `/* ── 외출/행선표 ── */` 부터 `.worker-status-scroll::-webkit-scrollbar-track { … }` 까지(현재 125~195줄)와, `.time-stepper` · `.time-stepper-value` · `.time-range-labels` 규칙(현재 926~948줄 부근)을 지운다. 지운 자리(`/* ── 현장 날씨 ── */` 바로 위)에 추가:

```css
        /* ── 계획/실적 표 (PR-3) ── */
        .pa-nav { display: inline-flex; align-items: center; gap: 6px; }
        .pa-nav-btn { width: 30px; height: 30px; border: 1px solid #c9d6e4; border-radius: 8px; background: #fff; color: #1f3045; font-size: 1rem; line-height: 1; }
        .pa-nav-btn:disabled { border-color: #e3ebf4; background: #f4f7fb; color: #b3c0cf; }
        .pa-nav-month { min-width: 56px; text-align: center; font-weight: 800; font-size: 1rem; color: #1f3045; }
        .pa-period { font-size: 0.74rem; color: #5b6f86; margin-bottom: 6px; }
        .pa-table { display: grid; grid-template-columns: 44px 1fr 1fr 64px; font-size: 0.95rem; font-variant-numeric: tabular-nums; }
        .pa-table > div { padding: 10px 4px; border-top: 1px solid #eef3f8; text-align: right; color: #2c3e55; }
        .pa-table > .pa-h { border-top: 0; border-bottom: 1px solid #dbe4ee; padding: 4px; font-size: 0.78rem; color: #5b6f86; }
        .pa-table > .pa-k { text-align: left; font-weight: 800; }
        .pa-table > .pa-k.construction { color: #1f6fd6; }
        .pa-table > .pa-k.settlement { color: #2b8a3e; }
        .pa-table > .pa-rate { font-weight: 800; color: #1f3045; }
        .pa-table .pa-fail { color: #b42318; font-weight: 700; }
        .pa-table .pa-dim { color: #8a99ab; }
        .pa-notice { margin-top: 8px; font-size: 0.78rem; color: #b42318; background: #fdecea; border-radius: 8px; padding: 6px 8px; }
```

- [ ] **Step 4: 캐시 버전 올리기**

마지막 `<script src="/home.js?v=20261029b"></script>` → `<script src="/home.js?v=20261110a"></script>`

- [ ] **Step 5: 남은 참조 확인**

Run (yjs_Dashboard, Git Bash): `grep -n "worker\|Worker\|time-stepper\|time-range" web/home.html`
Expected: 출력 없음.

---

### Task 3: home.js — 외출/행선표 코드 제거

**Files:**
- Modify: `web/home.js`

- [ ] **Step 1: 함수·변수 삭제**

다음을 **정의째** 지운다(이름으로 찾는다 — 줄 번호는 앞 작업으로 밀린다):
- 변수: `let workerReturnTimeModal = null;`, `let workerReturnTimeTargetUser = '';`
- 함수: `statusLabelText`, `statusBadgeClass`, `nextStatus`, `parseTimeText`, `halfHourIndexToTimeText`, `timeTextToHalfHourIndex`, `formatReturnTime`, `saveWorkerStatusPatch`, `loadWorkerStatusHome`, `handleWorkerStatusClickHome`, `handleWorkerLocationClickHome`, `handleWorkerUntilClickHome`, `shiftWorkerReturnTimeHome`, `updateWorkerReturnTimePreviewHome`, `saveWorkerReturnTimeHome`, `clearWorkerReturnTimeHome`
- **`managerStyle`은 지우지 않는다** — 지도 핀(`openTooltip`·`renderProgressMap`)이 쓴다.

- [ ] **Step 2: `initializeHomePage` 정리**

아래 줄들을 지운다:

```js
        workerReturnTimeModal = new bootstrap.Modal(document.getElementById('workerReturnTimeModal'));
```
```js
        const returnTimeSliderEl = document.getElementById('workerReturnTimeSlider');
        if (returnTimeSliderEl) {
            returnTimeSliderEl.addEventListener('input', updateWorkerReturnTimePreviewHome);
            returnTimeSliderEl.addEventListener('change', updateWorkerReturnTimePreviewHome);
        }
        updateWorkerReturnTimePreviewHome();
```

`await Promise.all([loadWorkerStatusHome(), loadFrequentSitesHome(), loadWeatherHome()]);` → `await Promise.all([loadFrequentSitesHome(), loadWeatherHome()]);`

`setInterval` 안의 `loadWorkerStatusHome();` 한 줄을 지운다.

파일 끝 `window.*` 내보내기에서 `loadWorkerStatusHome`·`handleWorker*`·`shiftWorkerReturnTimeHome`·`updateWorkerReturnTimePreviewHome`·`saveWorkerReturnTimeHome`·`clearWorkerReturnTimeHome` 7줄을 지운다(`window.loadFrequentSitesHome`은 남김).

- [ ] **Step 3: 남은 참조 확인**

Run: `grep -n "orker\|ReturnTime\|statusLabelText\|statusBadgeClass\|nextStatus\|parseTimeText\|halfHourIndex\|formatReturnTime" web/home.js`
Expected: 출력 없음.

Run: `node --check web/home.js`
Expected: 출력 없음(문법 오류 없음).

---

### Task 4: home.js — 보고 있는 달, month 로드, 실패 상태, 표 렌더

**Files:**
- Modify: `web/home.js`

설계 요점(구현 전에 읽을 것):
- 상태는 `totalProgressState` 한 벌. 새로 두는 건 "보고 있는 달" `monthNavState`와 요청 순번 `totalProgressLoadSeq`뿐.
- `viewMonth === ''` = 이번 달(ERP가 정한 금주 달). 지난 달을 보면 `'2026-09'` 같은 값.
- 60초 갱신은 **항상** month 없는 호출을 해 `latestMonth`(오른쪽 끝)를 갱신한다. 지난 달을 보는 중이면 그 결과를 화면에 적용하지 않고, 그 달을 month로 다시 부른다.
- 응답을 기다린 뒤에는 순번을 확인하고, 그 사이 새 로드가 시작됐으면 **아무것도 적용하지 않고** 끝낸다(‹ 연타 시 9월 숫자가 10월 제목 아래 그려지는 것 방지). 그래서 로더는 "받아오기"와 "적용"을 나눈다.
- 달 계산은 문자열로만 한다(`Date` 금지) — 브라우저 시간대가 달력을 바꾸는 자리를 만들지 않는다.

- [ ] **Step 1: 상수·상태 추가**

`const MONTHLY_PROGRESS_CONFIG_API = …` 다음 줄에:

```js
    // 계획/실적 표 ‹ › 왼쪽 끝. ERP gongmu/_lib/주차.ts 의 최소월과 같은 값 — 바꾸면 ERP 도 같이(어긋나면 ERP 가 400 으로 알린다)
    const MIN_PLAN_MONTH = '2026-09';
    // 지난 달을 보다 이만큼 지나면 이번 달로 돌아온다 — 전자칠판에 지난 달이 하루 종일 떠 있지 않게
    const VIEW_RETURN_MS = 5 * 60 * 1000;
    const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
```

`const targetModalState = { kind: 'construction' };` 바로 위에:

```js
    // 표·도넛·담당자 그래프·팝업이 함께 보는 달.
    //   latestMonth : month 없는 응답의 split.month(금요일 기준 금주 달) = ‹ › 오른쪽 끝. '' = 아직 모름 → ‹ › 둘 다 막음
    //   viewMonth   : '' = 이번 달(latestMonth 를 따름), 'YYYY-MM' = 지난 달을 보는 중
    //   loading     : ‹ › 직후 응답 전 — 옛 달 숫자를 새 달 제목 아래 남겨 두지 않으려고 '…'로 비운다
    //   actualError : 지난 달 실적(month 경로)을 못 받음 — 0 이나 6월 대체값으로 채우지 않는다
    const monthNavState = { latestMonth: '', viewMonth: '', viewSince: 0, loading: false, actualError: false };
    // 로드 순번. 응답을 기다린 뒤 이 값이 바뀌어 있으면(그 사이 ‹ › 나 60초 갱신이 새로 시작됨) 아무것도 적용하지 않는다
    let totalProgressLoadSeq = 0;
    // 지금 targets 가 어느 달의 목표인지. 목표 조회가 실패했을 때 다른 달 목표를 남겨 두지 않으려고 기억한다
    let targetsMonth = '';
```

- [ ] **Step 2: 달 계산 함수 추가**

`function formatKpiUpdatedAt(value) {` 바로 위에:

```js
    // 'YYYY-MM' 을 delta 달만큼 옮긴다. Date 를 쓰지 않는다 — 기기 시간대에 따라 달력이 바뀌는 자리를 만들지 않으려고
    function shiftMonth(ym, delta) {
        const idx = Number(ym.slice(0, 4)) * 12 + (Number(ym.slice(5, 7)) - 1) + delta;
        return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
    }

    // 지금 화면이 보여주는 달. 'YYYY-MM' 끼리는 문자열 비교가 곧 날짜 비교다
    function shownMonth() {
        return monthNavState.viewMonth || monthNavState.latestMonth;
    }

    function monthLabel(ym) {
        return `${Number(ym.slice(5, 7))}월`;
    }
```

- [ ] **Step 3: 지난 달 적용 / 실패 / 로딩 함수 추가**

`function applyErpMonthlyKpi(data) {` 바로 위에:

```js
    // ‹ › 를 누른 직후. 옛 달의 숫자·목표를 새 달 제목 아래 남기지 않는다 — 표·도넛·캡션이 모두 '…'/'-'가 된다
    function showMonthLoading(month) {
        monthNavState.loading = true;
        monthNavState.actualError = false;
        totalProgressState.label = monthLabel(month);
        totalProgressState.erpMonth = month;
        totalProgressState.periodFrom = '';
        totalProgressState.periodTo = '';
        totalProgressState.actualAmountThousand = null;
        totalProgressState.actualFromErp = true;
        totalProgressState.actualDetailText = '';
        totalProgressState.updatedAt = '';
        totalProgressState.sourceLabel = '';
        totalProgressState.breakdown = null;
        totalProgressState.settlement = null;
        totalProgressState.settlementEnabled = true;
        totalProgressState.targets = null;
        targetsMonth = '';
    }

    // 지난 달 응답 { status, month, split } 적용. 요청한 달과 다르거나 시공 실적이 없으면 false(→ 실패로 그림)
    function applyErpMonthSplit(data, month) {
        if (!data || data.month !== month) return false;
        const split = data.split && typeof data.split === 'object' ? data.split : null;
        if (!split || split.month !== month) return false;
        const construction = normalizeBreakdown(split.construction);
        if (!construction) return false;
        monthNavState.actualError = false;
        totalProgressState.erpMonth = month;
        totalProgressState.periodFrom = toDateStrings([split.from])[0] || '';
        totalProgressState.periodTo = toDateStrings([split.to])[0] || '';
        totalProgressState.label = monthLabel(month);
        totalProgressState.actualAmountThousand = construction.totalThousand;
        totalProgressState.actualFromErp = true;
        totalProgressState.actualDetailText = '';
        // month 응답엔 updatedAt 이 없다. 비워 두면 formatKpiUpdatedAt 이 대체값 날짜(2026-06-18)를 찍으므로 받은 시각을 적는다
        // (기존 최신화 표기와 같은 브라우저 시계 — 국내 상황판 가정)
        totalProgressState.updatedAt = formatKpiUpdatedAt(new Date().toISOString());
        totalProgressState.sourceLabel = '(ERP)';
        totalProgressState.breakdown = construction;
        totalProgressState.settlement = normalizeSettlement(split.settlement);
        totalProgressState.settlementEnabled = true;
        return true;
    }

    // 지난 달 실적을 못 받음. 대체값 경로(resetErpMonthlyKpiToFallback)로 보내지 않는다 —
    // 그 경로는 6월 숫자를 그리므로 '9월' 제목 아래 6월 실적이 에러 없이 찍힌다. 실적 칸은 '못 불러옴', 목표는 그대로 보인다.
    function markErpMonthFailed(month) {
        showMonthLoading(month);
        monthNavState.loading = false;
        monthNavState.actualError = true;
    }
```

주의: `markErpMonthFailed`는 `showMonthLoading`을 거치며 `targets`를 비운다. 목표는 바로 다음 `loadMonthlyProgressConfigHome`이 그 달로 다시 채운다(Step 5의 순서).

- [ ] **Step 4: 퍼센트 함수에 로딩·실패 가드**

`function getTotalProgressPercent() {` 본문 맨 앞에 추가:

```js
        // 지난 달 로딩·실패 중엔 숫자가 없다 — 아래 대체값 분기(수동 공정률)로 떨어지지 않게 먼저 막는다
        if (monthNavState.loading || monthNavState.actualError) return null;
```

(`getSettlementPercent`는 손대지 않는다 — 로딩·실패 때 `settlement`와 `targets`가 null이라 이미 `nodata`를 돌려준다.)

- [ ] **Step 5: 로더 재구성 (받아오기 / 적용 분리 + 순번)**

`loadMonthlyProgressConfigHome`, `loadErpMonthlyKpiHome`, `loadTotalProgressHome` 세 함수를 통째로 아래로 교체:

```js
    // 받아오기만 한다(적용은 loadTotalProgressHome 이 순번을 확인한 뒤). 실패는 { ok:false } — 400 과 503 을 화면에선 같은 '못 불러옴'으로 그린다
    async function fetchJson(url) {
        try {
            const res = await fetch(url);
            if (!res.ok) return { ok: false, status: res.status };
            return { ok: true, data: await res.json() };
        } catch (_e) {
            return { ok: false, status: 0 };
        }
    }

    // 목표는 화면이 보는 달(ERP 금요일 기준 달)로 부른다 — 서버의 달력 월로 부르면 9/28~30 에 10월 실적 / 9월 목표가 된다.
    // month 가 비면(옛 ERP·대체값) 서버 기본(달력 월)으로 부른다.
    function monthlyProgressConfigUrl(month) {
        return month ? `${MONTHLY_PROGRESS_CONFIG_API}?month=${encodeURIComponent(month)}` : MONTHLY_PROGRESS_CONFIG_API;
    }

    // 실적을 먼저 받아 달을 정하고, 그 달의 목표를 받은 뒤 한 번만 그린다(새 달 실적 / 옛 달 목표가 잠깐 그려지지 않게).
    // 60초 갱신과 ‹ › 가 같은 함수를 부른다 — 늦게 끝난 쪽이 먼저 시작한 쪽 결과를 덮지 않게 순번으로 거른다.
    async function loadTotalProgressHome() {
        const seq = ++totalProgressLoadSeq;
        if (monthNavState.viewMonth && Date.now() - monthNavState.viewSince >= VIEW_RETURN_MS) {
            monthNavState.viewMonth = '';
            monthNavState.actualError = false;
        }

        // ① 이번 달(month 없음) — 오른쪽 끝을 알려면 지난 달을 보는 중에도 항상 부른다
        const current = await fetchJson(ERP_MONTHLY_KPI_API);
        if (seq !== totalProgressLoadSeq) return;
        if (current.ok) {
            const split = current.data && current.data.split;
            const latest = split && MONTH_RE.test(String(split.month || '')) ? split.month : '';
            monthNavState.latestMonth = latest;
            // 금주 달이 넘어가 보던 달과 같아졌으면 이번 달 화면으로 친다
            if (latest && monthNavState.viewMonth && monthNavState.viewMonth >= latest) monthNavState.viewMonth = '';
        }

        const viewing = monthNavState.viewMonth;
        if (!viewing) {
            const wasLoading = monthNavState.loading;
            monthNavState.loading = false;
            monthNavState.actualError = false;
            // 기존 동작 그대로: 응답은 왔는데 시공 실적이 없으면 대체값, fetch 실패면 마지막 값 유지(백로그 B안 범위)
            if (current.ok) {
                if (!applyErpMonthlyKpi(current.data)) resetErpMonthlyKpiToFallback();
            } else if (wasLoading) {
                // › 로 이번 달에 돌아온 직후 실패 — showMonthLoading 이 '마지막 값'을 이미 비웠다.
                // 그대로 두면 actualAmountThousand=null 이 캡션에서 '시공 0'으로 찍히므로 실패로 그린다
                markErpMonthFailed(totalProgressState.erpMonth);
            }
        } else {
            // ② 지난 달(month 경로)
            const past = await fetchJson(`${ERP_MONTHLY_KPI_API}?month=${encodeURIComponent(viewing)}`);
            if (seq !== totalProgressLoadSeq) return;
            monthNavState.loading = false;
            if (!past.ok || !applyErpMonthSplit(past.data, viewing)) markErpMonthFailed(viewing);
        }

        // ③ 그 달의 목표
        const month = totalProgressState.erpMonth;
        const cfg = await fetchJson(monthlyProgressConfigUrl(month));
        if (seq !== totalProgressLoadSeq) return;
        if (cfg.ok && applyMonthlyProgressConfig(cfg.data)) {
            targetsMonth = month;
        } else if (targetsMonth !== month) {
            // 같은 달이면 마지막 목표를 유지(일시 장애로 흔들리지 않게), 다른 달이면 비운다 — 다른 달 계획을 이 달 계획으로 그리지 않게
            totalProgressState.targets = null;
        }
        renderTotalProgressChartHome();
    }

    // ‹ › 한 칸. 범위 밖이면 아무것도 안 한다(버튼도 막혀 있다)
    function goPlanActualMonth(delta) {
        const base = shownMonth();
        if (!base || !monthNavState.latestMonth) return;
        const next = shiftMonth(base, delta);
        if (next < MIN_PLAN_MONTH || next > monthNavState.latestMonth) return;
        monthNavState.viewMonth = next === monthNavState.latestMonth ? '' : next;
        monthNavState.viewSince = Date.now();
        showMonthLoading(next);
        renderTotalProgressChartHome();
        loadTotalProgressHome();
    }
```

`applyMonthlyProgressConfig`는 그대로 둔다(`cfg.label`로 제목을 관리자 라벨로 덮는 동작 포함).

- [ ] **Step 6: 도넛 가운데·캡션에 로딩·실패 문구**

`renderTotalProgressChartHome` 안의
`const noTargetText = totalProgressState.targets ? '미등록' : '-';` →

```js
        // 실적을 못 받았는데 목표가 있으면 '미등록'이 찍힌다 — 고칠 곳(관리자 입력)을 잘못 가리키므로 실적 쪽 사정이 먼저다
        const noTargetText = (monthNavState.loading || monthNavState.actualError || !totalProgressState.targets) ? '-' : '미등록';
```

이어서 `if (amtEl) {` 블록의 맨 앞(`const detailHtml = …` 위)에 추가:

```js
            // 지난 달 로딩·실패 — 0 을 찍지 않는다(진짜 0 과 구분되게). 목표 조각은 그대로 붙여 목표는 보이게 한다
            if (monthNavState.loading || monthNavState.actualError) {
                const msg = monthNavState.loading ? '불러오는 중…' : '실적 불러오지 못함';
                amtEl.innerHTML =
                    `<span style="color:${monthNavState.loading ? '#8a99ab' : '#b42318'};">${msg}</span>` +
                    buildTargetFractionHtml('construction');
                renderManagerProgressHome();
                renderPlanActualTableHome();
                return;
            }
```

같은 함수 맨 끝의 `renderManagerProgressHome();` 다음 줄에 `renderPlanActualTableHome();`를 추가한다.

- [ ] **Step 7: 표 렌더 함수 추가**

`function buildTargetFractionHtml(kind) {` 바로 위에:

```js
    // ══════════ 계획/실적 표 (PR-3) ══════════
    // 도넛·담당자 그래프와 같은 상태에서 그린다. 실행률은 도넛과 같은 함수(getTotalProgressPercent·getSettlementPercent)로 —
    // 표의 % 와 도넛의 % 가 같은 계산에서 나와 갈라질 자리가 없다. 100% 에서 자르지 않는다(설계 §7-3), 계획 0 이면 '—'(§7-5).
    function renderPlanActualTableHome() {
        const bodyEl = document.getElementById('planActualBody');
        if (!bodyEl) return;
        const fmt = (n) => Number(n).toLocaleString('ko-KR');
        const open = (which, text) => `<span class="tp-clickable" role="button" tabindex="0" data-tp-open="${which}">${text}</span>`;
        const nav = monthNavState;
        const shown = shownMonth();

        const monthEl = document.getElementById('planActualMonth');
        if (monthEl) monthEl.textContent = shown ? monthLabel(shown) : totalProgressState.label;
        const prevEl = document.getElementById('planActualPrev');
        const nextEl = document.getElementById('planActualNext');
        if (prevEl) prevEl.disabled = !shown || !nav.latestMonth || shiftMonth(shown, -1) < MIN_PLAN_MONTH;
        if (nextEl) nextEl.disabled = !shown || !nav.latestMonth || shown >= nav.latestMonth;
        const periodEl = document.getElementById('planActualPeriod');
        if (periodEl) periodEl.textContent = `단위 천원${periodSubText()}`;
        const noticeEl = document.getElementById('planActualNotice');
        if (noticeEl) {
            noticeEl.style.display = nav.actualError ? '' : 'none';
            noticeEl.textContent = nav.actualError ? 'ERP 실적을 불러오지 못했습니다 · 1분 뒤 다시 시도합니다' : '';
        }

        const t = totalProgressState.targets;
        const planCell = (kind) => {
            if (!t) return '<span class="pa-dim">-</span>';
            if (!t[kind].rows.length) return '<span class="pa-dim">미등록</span>';
            return open(`target-${kind}`, fmt(t[kind].totalThousand));
        };
        const actualCell = (kind) => {
            if (nav.loading) return '<span class="pa-dim">…</span>';
            if (nav.actualError) return '<span class="pa-fail">못 불러옴</span>';
            if (kind === 'construction') {
                // 대체값 화면(ERP 시공 실적 없음)에선 6월 숫자를 표로 옮기지 않는다
                const b = totalProgressState.actualFromErp ? totalProgressState.breakdown : null;
                return b ? open('actual', fmt(b.totalThousand)) : '<span class="pa-dim">-</span>';
            }
            if (!totalProgressState.settlementEnabled) return '<span class="pa-dim">-</span>';
            const s = totalProgressState.settlement;
            return s ? open('settlement', fmt(s.totalThousand)) : '<span class="pa-fail">못 불러옴</span>';
        };
        const rateCell = (kind) => {
            if (nav.loading) return '<span class="pa-dim">…</span>';
            if (kind === 'construction') {
                const pct = totalProgressState.actualFromErp ? getTotalProgressPercent() : null;
                return pct === null ? '<span class="pa-dim">—</span>' : `${pct}%`;
            }
            const s = getSettlementPercent();
            return s.state === 'ok' ? `${s.value}%` : '<span class="pa-dim">—</span>';
        };

        const row = (kind, label) =>
            `<div class="pa-k ${kind}">${label}</div><div>${planCell(kind)}</div><div>${actualCell(kind)}</div><div class="pa-rate">${rateCell(kind)}</div>`;
        bodyEl.innerHTML =
            '<div class="pa-h"></div><div class="pa-h">계획</div><div class="pa-h">실적</div><div class="pa-h">실행률</div>' +
            row('construction', '시공') + row('settlement', '정산');
    }
```

- [ ] **Step 8: 클릭 연결**

`bindProgressDetailHandlers` 안 `['totalProgressAmount', 'managerProgressList'].forEach(` → `['totalProgressAmount', 'managerProgressList', 'planActualBody'].forEach(` (표의 숫자를 누르면 도넛 캡션과 같은 상세 팝업이 같은 달로 열린다).

`initializeHomePage`에서 `bindProgressDetailHandlers();` 다음 줄에:

```js
        const paPrev = document.getElementById('planActualPrev');
        const paNext = document.getElementById('planActualNext');
        if (paPrev) paPrev.addEventListener('click', () => goPlanActualMonth(-1));
        if (paNext) paNext.addEventListener('click', () => goPlanActualMonth(1));
```

- [ ] **Step 9: 문법 확인**

Run: `node --check web/home.js`
Expected: 출력 없음.

Run: `grep -n "loadErpMonthlyKpiHome\|loadMonthlyProgressConfigHome" web/home.js`
Expected: 출력 없음(교체된 옛 이름이 남아 있지 않음).

---

### Task 5: 브라우저 확인 (로컬 대시보드 + 운영 ERP)

로컬 `.env`의 `ERP_MONTHLY_KPI_URL`이 운영 ERP를 가리키는지 먼저 본다(PR #52 운영 배포 완료). 아니면 사용자에게 묻는다.

- [ ] **Step 1:** `python main.py`로 띄우고 로그인해 홈을 연다(1600×900). 콘솔 에러 0을 확인한다.
- [ ] **Step 2: 이번 달** — 표 11월: 시공 계획 831,787 / 정산 계획 801,120. 시공 실적·정산 실적이 도넛 캡션 숫자와 같고, 표 실행률 = 도넛 가운데 %와 같다. › 막힘, ‹ 열림.
- [ ] **Step 3: ‹ 10월** — 표·도넛 제목·담당자 그래프가 모두 10월. 시공 실적 494,834(공무 화면·매출손익 금요일 표와 같은 값). 계획 552,661 / 490,334. 기간 표기 "9/28~11/1". 표의 실적 숫자 클릭 → 상세 팝업 합계 = 표 숫자.
- [ ] **Step 4: ‹ 9월** — 시공 실적 250,773, 계획 396,750 / 638,916. ‹ 막힘. 담당자 그래프에서 계획이 '담당 미지정' 칸에 몰린다(§7-6, 의도).
- [ ] **Step 5: 연타** — 11월에서 ‹를 빠르게 두 번 → 최종 9월 제목 아래 9월 숫자(10월 숫자가 남지 않음). 네트워크 탭에서 응답 순서를 확인.
- [ ] **Step 6: 실패** — 개발자 도구에서 `/api/erp/monthly-kpi?month=` 요청을 차단(Network request blocking)하고 ‹ → 실적 '못 불러옴', 실행률 '—', 안내 줄, 도넛 '-', 캡션 '실적 불러오지 못함'. 계획 숫자는 보인다. 0이나 6월 숫자가 어디에도 없다.
- [ ] **Step 7: 5분 복귀** — 콘솔에서 확인용으로 지난 달을 연 뒤 5분(+60초 이내) 기다려 11월로 돌아오는지 본다. (기다리기 어려우면 `VIEW_RETURN_MS`를 임시로 10초로 바꿔 확인하고 **되돌린다**.)
- [ ] **Step 8: 외출/행선표 흔적** — 홈에 외출/행선표 없음, 자재 현황·지도·날씨·바로가기 정상. 일정 화면(`dashboard.html`)의 행선 기능은 그대로 동작.

---

### Task 6: 게이트 3·4·5 (구현 세션)

- [ ] 게이트 3: 비판적 리뷰(엣지: 금주 달이 넘어가는 월요일 00시 KST에 지난 달을 보고 있던 경우, `latestMonth` 를 모르는 동안 ‹ › 막힘, 목표 조회 실패 시 다른 달 목표 잔존 여부, 중계 400 문구 노출 범위)
- [ ] 게이트 4: 질문 1~2개(바닥 개념 — 예: 상태코드 400 vs 503을 중계가 가른 이유 / 순번 확인이 없을 때 화면에 무엇이 어떤 모양으로 찍히나)
- [ ] 게이트 5: 커밋 메시지는 사용자가 작성. 커밋 단위 제안: ① 중계(`erp.py` + 테스트) ② 홈(`home.html` + `home.js`, 한 커밋 — 버전 섞임 방지). 커밋 뒤 `git status`로 빠진 파일 확인(PowerShell `git add` 경로 줄바꿈 사고 이력).
- [ ] PR 오픈(yjs_Dashboard). 배포 순서: ERP는 이미 배포됨 → 대시보드. 배포 전 사장님께 목업 확인(설계 §7-1·§7-6과 함께).

## 범위 밖 / 백로그

- 이번 달 대체값 화면(B안): ERP 실패 시 6월 하드코딩 숫자 — 9/28부터의 백로그 그대로. 이번 PR은 그 화면을 표로 **옮기지 않는 것**까지만(표는 '-').
- `MIN_PLAN_MONTH` 두 레포 중복 — ERP 응답이 최소월을 내려주게 하면 사라짐(필요해지면).
- 외출/행선표 API·DB 테이블 정리 — 일정 화면이 계속 쓰므로 유지.
