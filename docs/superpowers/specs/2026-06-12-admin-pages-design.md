# 관리자 페이지 설계 — 거래처 관리 + 공사단가 관리

> 작성일: 2026-06-12

---

## 범위

- `(protected)` 라우트 그룹 삭제 (dead code)
- `/admin/clients` — 거래처 관리
- `/admin/rates` — 공사단가 관리

---

## 1. `(protected)` 삭제

`src/app/(protected)/` 폴더 전체 삭제. `layout.tsx` + `dashboard/page.tsx` 모두 미사용.

---

## 2. 거래처 관리 (`/admin/clients`)

### 화면 구조

- 상단 툴바: 검색 input + "새 거래처" 버튼
- DataTable: 거래처코드 / 거래처명 / 법인 / 보험료제외율(%) / 하도전용율(%) / 비고 / 수정 버튼
- 우측 Sheet: 등록·수정 겸용 (행 수정 버튼 or "새 거래처" 버튼으로 열림)
- 삭제: Sheet 하단 삭제 버튼 → 확인 없이 삭제 후 Sheet 닫힘 + 토스트

### Sheet 필드

| 필드 | 필수 | 비고 |
|------|------|------|
| 거래처코드 | ✅ | 수정 시 읽기전용 (UNIQUE 제약) |
| 거래처명 | ✅ | |
| 법인 | | |
| 보험료제외율 (%) | | 0–100 숫자 |
| 하도전용율 (%) | | 0–100 숫자 |
| 비고 | | textarea |

### 데이터 흐름

- 목록: `supabase.from('거래처').select().order('거래처명')` (서버 컴포넌트)
- 등록/수정/삭제: Server Action (`_actions/clients.ts`)
- 클라이언트에서 낙관적 업데이트 없이 `router.refresh()` 후 재조회

---

## 3. 공사단가 관리 (`/admin/rates`)

### 화면 구조

- 툴바: "항목 추가" 버튼 + 안내 텍스트
- 고정 테이블: 투입구분별 현행 단가 (최신 레코드 1개씩)
- 컬럼: 투입구분 / 주간단가 / 야간단가 / 적용시작일 / 수정 버튼 / 삭제 버튼

### 인라인 편집

- 행 수정 버튼 클릭 → 해당 행이 input 필드로 전환
- 동시에 한 행만 편집 가능 (다른 행 수정 버튼 비활성화)
- 저장: 해당 레코드 직접 UPDATE
- 취소: 입력값 원복

### 항목 추가

- "+ 항목 추가" → 테이블 하단에 빈 입력 행 추가
- 투입구분 text input + 주간단가 + 야간단가 + 적용시작일 입력
- 저장: INSERT new record

### 삭제

- 행 삭제 버튼 → 즉시 DELETE + 토스트 알림 (confirm 없음)

### 데이터 흐름

- 목록: 투입구분별 `MAX(id)` 또는 `MAX(적용시작일)` 기준 최신 레코드 조회
  - `SELECT DISTINCT ON (투입구분) * FROM 공사단가 ORDER BY 투입구분, 적용시작일 DESC`
- 등록/수정/삭제: Server Action (`_actions/rates.ts`)
- 저장 후 `router.refresh()`

---

## 4. 공통 패턴

- **라우트**: `src/app/(dashboard)/admin/clients/page.tsx`, `src/app/(dashboard)/admin/rates/page.tsx`
- **Server Actions**: `_actions/clients.ts`, `_actions/rates.ts` (각 폴더 내)
- **클라이언트 컴포넌트**: `ClientsClient.tsx`, `RatesClient.tsx` (각 폴더 내)
- **인증**: `(dashboard)` layout이 이미 처리
- **디자인 시스템**: 기존 Tailwind 클래스 + 색상 변수 그대로 따름
- **토스트**: 기존 `/progress`, `/input`에서 쓰는 floating toast 패턴 동일 적용
