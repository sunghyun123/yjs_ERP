# 변경내역 추적 (Update History Tracking) — 설계 스펙

작성일: 2026-06-24
상태: 설계 확정, 구현 플랜 작성 대기

## 1. 배경 / 목적

신규 ERP가 파일럿 배포된 직후 단계다. 시스템이 안정적으로 자리잡기까지 운영자는
**기존(레거시) ERP에도 같은 변경을 이중 입력**해야 한다. 따라서 "신규 ERP에 최근
무엇이 들어왔는지"를 빠짐없이 보고 옛 ERP에 옮길 수 있어야 한다.

이 기능은 **수개월 한시적 운영 보조 도구**다. 신규 ERP가 단독 운영되면 제거 대상.

### 핵심 발견 (설계를 가른 사실)
- 대부분 테이블(`수주`, `기성`, `투입실적`, `투입실적상세`, `공사현장`, `거래처`,
  `공사단가`, `공무담당자`)에는 `생성일`(서버 `now()` 기본값)이 있다.
- 그러나 **`공사이력`에는 `생성일`이 없다.** `작업일자`(사용자 입력 업무일)만 존재.
  → 소급 입력(오늘 입력했지만 작업일자는 지난주)은 `작업일자` 기준 조회로는
  "오늘 들어온 변경"으로 잡히지 않는다.
- 또한 요구사항이 **삭제·수정·준공완료까지 전부 포착**이므로, 기존 컬럼
  단순 조회로는 불가능하다(삭제 행은 사라지고, 수정/준공은 `생성일`이 안 바뀜).

→ **별도 감사 로그 테이블을 DB 트리거로 채우는 방식**이 요구사항을 만족하는
유일한 구조다.

## 2. 요구사항

- **추적 대상**: `수주`(등록·준공·수정·삭제), `기성`, `공사이력`(공정률/성과),
  `투입실적`, `투입실적상세`, + 마스터(`거래처`, `공사단가`, `공사현장`, `공무담당자`).
- **포착 범위**: INSERT · UPDATE · DELETE 전부, 누락 없이.
- **화면**: 읽기 전용. 기간(날짜 범위) + 분류 필터로 조회. 동기화 상태 저장 없음.
- **표시**: 핵심 컬럼 요약 + 행 펼치면 전체 스냅샷(jsonb) 보기.

## 3. 채택 방식 / 기각안

**채택 — DB 트리거 → 감사 로그 테이블.**
이유: 어느 코드 경로로 바꾸든 무조건 잡히고, **삭제도 삭제 직전 스냅샷으로 확실히
포착**된다. 앱 코드 수정 0, 새 입력 화면이 생겨도 자동 적용. "누락 없이 전부"라는
요구를 구조적으로 보장.

기각:
- **앱 레벨 로깅**(각 mutation 위치에서 직접 기록): 10곳 넘는 호출 지점을 손봐야
  하고 하나라도 빠지면 누락(특히 삭제). 새 mutation 경로가 늘면 또 깨짐.
- **pgaudit / WAL / 로지컬 리플리케이션**: 외부 도구·과한 인프라. 한시적 도구엔 오버킬.

## 4. 데이터 모델

### 4.1 `audit_log` 테이블

| 컬럼 | 타입 | 의미 |
|---|---|---|
| `id` | bigint identity | PK |
| `table_name` | text not null | 대상 테이블명 (`수주`, `기성`, …) |
| `operation` | text not null, check in (INSERT,UPDATE,DELETE) | 동작 |
| `row_id` | bigint | 영향받은 행의 id |
| `old_data` | jsonb | 변경 전 스냅샷 (INSERT는 null) |
| `new_data` | jsonb | 변경 후 스냅샷 (DELETE는 null) |
| `changed_at` | timestamptz not null default now() | **실제 입력 시각** |

`actor`(누가) 컬럼은 두지 않는다 — 사실상 단일 운영자라 불필요.

`changed_at`이 `공사이력`의 `생성일` 부재 문제를 해결한다. 소급 입력도 실제 insert
시각으로 정확히 잡힌다.

### 4.2 범용 트리거 함수 `audit_trigger()`

- `language plpgsql`, **`security definer`**.
- `TG_OP` / `TG_TABLE_NAME`으로 분기, `to_jsonb(NEW)` / `to_jsonb(OLD)`로 스냅샷.
  - INSERT → `new_data = to_jsonb(NEW)`, `old_data = null`, `row_id = NEW.id`
  - UPDATE → `old_data = to_jsonb(OLD)`, `new_data = to_jsonb(NEW)`, `row_id = NEW.id`
  - DELETE → `old_data = to_jsonb(OLD)`, `new_data = null`, `row_id = OLD.id`

**`security definer`가 필요한 이유**: `audit_log`에 RLS를 켜면, 일반 사용자의
mutation이 트리거를 통해 `audit_log`에 INSERT를 시도할 때 RLS에 막혀 *원래 작업까지
실패*한다. 함수를 소유자(postgres) 권한으로 실행해 RLS를 우회한다.

### 4.3 트리거 부착 대상

다음 테이블 각각에 `AFTER INSERT OR UPDATE OR DELETE ... FOR EACH ROW`:
`수주`, `기성`, `공사이력`, `투입실적`, `투입실적상세`, `공사현장`, `거래처`,
`공사단가`, `공무담당자`. 모두 `id` 컬럼을 가지므로 범용 함수가 그대로 동작.

### 4.4 RLS

- `audit_log`에 RLS 활성화.
- SELECT 정책: `(select public.is_admin())`만 허용. (`is_admin()` 헬퍼는
  `20260622090300_rls_admin_writes.sql`에 존재.)
- INSERT/UPDATE/DELETE 정책은 만들지 않음 → 클라이언트 직접 조작 불가.
  기록은 `security definer` 트리거만 수행.

## 5. 화면 / UX (`/admin/updates`)

읽기 전용 서버 페이지 + 클라이언트 필터. `/admin` 레이아웃이 이미 admin 게이트
(`AdminLayout`) → RLS와 이중 방어.

### 5.1 필터
- 기간: 시작일~종료일. 기본 = 최근 7일. 결과 상한 500행.
- 분류: 전체 / 수주등록 / 준공완료 / 기성 / 공사이력 / 투입실적 / 마스터 (멀티 선택).

### 5.2 분류 라벨 도출 — `_lib/category.ts` (순수 함수)

`audit_log` 행 → 사람이 읽는 분류:

| 조건 | 라벨 |
|---|---|
| `수주` INSERT | 수주등록 |
| `수주` UPDATE, `준공여부` false→true | **준공완료** |
| `수주` UPDATE (그 외) | 수주수정 |
| `수주` DELETE | 수주삭제 |
| `기성` INSERT/UPDATE/DELETE | 기성등록/수정/삭제 |
| `공사이력` INSERT/UPDATE/DELETE | 공사이력 등록/수정/삭제 (공정률·성과) |
| `투입실적`·`투입실적상세` INSERT/UPDATE/DELETE | 투입실적 등록/수정/삭제 |
| `거래처`·`공사단가`·`공사현장`·`공무담당자` | 마스터: {테이블}{동작} |

준공완료 감지: `old_data->>'준공여부'`가 false이고 `new_data->>'준공여부'`가 true.

### 5.3 표시 행
`changed_at` · 분류 뱃지 · 핵심 컬럼 요약 · row_id. 행을 펼치면 전체 스냅샷
(`old_data`/`new_data` jsonb) 표시.

### 5.4 id→이름 해석 — `_lib/format.ts`
스냅샷에는 FK가 id로 저장됨(`거래처_id`, `담당공무_id`, `수주_id` 등). 옛 ERP
재입력을 위해 이름이 필요하므로, 페이지가 조회 맵(거래처 id→상호, 공무 id→이름,
수주 id→현장명 등)을 한 번 로드해 요약을 만든다. 테이블별 요약 포맷터를 한 곳에 모음.
이름 해석 실패 시 fallback: `"id:123"`.

예시 요약:
`수주등록 · 현장명 "○○현장" · 거래처 ○○건설 · 계약금액 1.2억 · 담당공무 홍길동`

### 5.5 사이드바
`src/components/sidebar/Sidebar.tsx`에 `/admin/updates` 링크 추가 (admin 메뉴 영역).

## 6. 엣지케이스

- **무의미한 UPDATE**(값 변화 없이 재저장)도 로그됨 → 노이즈. 1차엔 그대로 둠.
  거슬리면 추후 `old_data IS DISTINCT FROM new_data` 가드 추가 여지.
- **마이그레이션/벌크 스크립트** 폭주: 트리거는 배포 이후부터 쌓이므로 실운영 영향
  없음. 과거 데이터 소급 기록 안 함(요구사항도 "최근 변경 추적").
- **테이블 무한 증가**: 한시적 도구 → 수개월 후 프루닝/드롭 메모만 남김(지금 구현
  안 함, YAGNI).

## 7. 테스트

- 순수 함수가 테스트 단위:
  - `category.ts`: 준공완료 감지(false→true), 삭제 라벨, 마스터 라벨 등.
  - `format.ts`: FK 이름 해석, 해석 실패 fallback(`id:123`), 핵심 컬럼 추출.
- 트리거 동작: 마이그레이션 적용 후 수동 1회 검증(insert/update/delete 각 1건 →
  `audit_log` 확인).

## 8. 구성요소 경계

- `supabase/migrations/<ts>_audit_log.sql` — 테이블 + 함수 + 트리거 + RLS.
- `src/types/database.ts` — `audit_log` 타입 추가.
- `src/app/(dashboard)/admin/updates/page.tsx` — 서버: 로그 fetch + 조회 맵 로드.
- `src/app/(dashboard)/admin/updates/_components/UpdatesClient.tsx` — 필터 + 테이블 + 펼치기.
- `src/app/(dashboard)/admin/updates/_lib/category.ts` — 분류 라벨 도출(순수).
- `src/app/(dashboard)/admin/updates/_lib/format.ts` — 요약 포맷터 + id→이름(순수).
- `src/components/sidebar/Sidebar.tsx` — 링크 추가.
