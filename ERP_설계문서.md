# 전기공사 ERP 설계 문서

> 작성일: 2026-06-04 | 목적: EMAX ERP(Windows 데스크탑) → 웹 기반 자체 구축

---

## 1. 프로젝트 배경

**기존 문제:** PC 전용, API 없음, UI 낙후, 소수점 버그, 외주 의존  
**자체 구축 목표:** 웹 접근 + REST API 즉시 확보 + 계산 로직 직접 관리

**공무팀 UX 개선 (자동화 아닌 실용 편의):**
- 공사명 자동완성 (지중No 입력 시)
- Tab 키 이동 최적화
- ※ AI OCR 방식 배제 — 속도(30초 > 수동 10초) · 비용 문제

---

## 2. 기술 스택

| 역할 | 도구 |
|------|------|
| DB + REST API | Supabase PostgreSQL |
| 프론트엔드 | Next.js 16 (App Router) + TypeScript |
| UI | shadcn/ui + Tailwind CSS v4 |
| 입력 검증 | Zod v4 |
| 차트 | Recharts |
| 배포 | VPS hpa_1.4-g2 (1vCPU/4GB, 25,200원/월 — 기지불) |
| 웹서버 | Nginx + PM2 |

**배포 URL:** `erp.yjsboard.com` (포트 3001, SSL 만료 2026-09-07 자동갱신)

---

## 3. DB 스키마

### 테이블 목록

| 테이블 | 역할 |
|--------|------|
| `거래처` | 원청사/발주자 마스터 |
| `공사단가` | 직종별 주/야간 단가 이력 (적용시작일 기준) |
| `수주` | 프로젝트 기본 정보 + 보험료율·하도전용율 직접 저장 |
| `공사이력` | 일별 달성률 증분 기반 성과금액 |
| `기성` | 차수별 기성금 (누적기성 조회용) |
| `투입실적` | 일별 직종별 투입 인원 |
| `시스템설정` | 일반관리비율(6%) 등 전사 설정 |
| `계획금액` | 월별 성과 계획금액 (YYYY-MM PK) |

### 거래처

```sql
CREATE TABLE 거래처 (
  id            SERIAL PRIMARY KEY,
  거래처코드    VARCHAR(10) UNIQUE NOT NULL,
  거래처명      VARCHAR(100) NOT NULL,
  보험료제외율  DECIMAL(6,4),
  하도전용율    DECIMAL(6,4),
  법인          VARCHAR(50),
  비고          TEXT,
  생성일        TIMESTAMP DEFAULT NOW()
);
```

### 공사단가

```sql
CREATE TABLE 공사단가 (
  id          SERIAL PRIMARY KEY,
  적용시작일  DATE NOT NULL,
  투입구분    VARCHAR(20) NOT NULL,
  주간단가    INTEGER NOT NULL,
  야간단가    INTEGER,
  비고코드    VARCHAR(10),
  생성자      INTEGER REFERENCES 사용자(id),
  생성일      TIMESTAMP DEFAULT NOW(),
  수정자      INTEGER REFERENCES 사용자(id),
  수정일      TIMESTAMP
);
```

**현행 단가 (2025-10-27 기준):**

| 투입구분 | 주간단가 | 야간단가 |
|---------|---------|---------|
| 상용직 | 631,847 | 631,847 |
| 일용직 | 200,000 | 235,000 |
| 모범신호수 (h) | 30,000 | 40,000 |
| 6W | 730,000 | 1,000,000 |
| 3W | 630,000 | 870,000 |
| 덤프15T | 550,000 | 650,000 |
| 크레인 | 800,000 | 800,000 |
| 물청소차 | 300,000 | 300,000 |
| MCM | 3,000,000 | 3,000,000 |
| 재료비/인 | 161,000 | 161,000 |
| 접속 | 225,000 | 225,000 |
| 기타 | -1,086,192 | — |

> 단가 적용: `적용시작일 <= 투입일` 중 가장 최근 레코드

### 수주

> ⚠️ 보험료율·하도전용율은 `거래처`에서 JOIN 하지 않고 `수주` 테이블에 직접 저장 (원청사 기준, 수주별로 다름)

```sql
CREATE TABLE 수주 (
  id                  SERIAL PRIMARY KEY,
  지중no              VARCHAR(20) UNIQUE NOT NULL,
  공사번호            VARCHAR(50),
  공사명              VARCHAR(200) NOT NULL,
  법인                VARCHAR(50),
  공사구분            VARCHAR(20),
  공사종류            VARCHAR(20),
  공사현장            VARCHAR(50),
  작업구분            VARCHAR(20),
  시공상태            VARCHAR(20),
  준공여부            BOOLEAN DEFAULT FALSE,
  정산상태            VARCHAR(20),
  포장여부            BOOLEAN DEFAULT FALSE,
  자재청구여부        BOOLEAN DEFAULT FALSE,
  발주자_id           INTEGER REFERENCES 거래처(id),
  원청사_id           INTEGER REFERENCES 거래처(id),
  공사담당            VARCHAR(50),
  감독자              VARCHAR(50),
  관리자              VARCHAR(50),
  관리자_연락처       VARCHAR(20),
  수주금액_공급가     DECIMAL(15,2),
  보험료율            FLOAT,
  하도전용율          FLOAT,
  착공일              DATE,
  준공일              DATE,
  준공액_공급가       DECIMAL(15,2),
  달성율              DECIMAL(5,2),
  참고사항            TEXT,
  안전회의            VARCHAR(10),
  생성자              TEXT REFERENCES 사용자(id),
  생성일              TIMESTAMP DEFAULT NOW(),
  수정자              TEXT REFERENCES 사용자(id),
  수정일              TIMESTAMP
);
```

### 공사이력

```sql
CREATE TABLE 공사이력 (
  id         SERIAL PRIMARY KEY,
  수주_id    INTEGER NOT NULL REFERENCES 수주(id),
  작업일자   DATE NOT NULL,
  성과금액   DECIMAL(15,2),  -- Δ달성률/100 × 하도적용금액
  UNIQUE (수주_id, 작업일자)
);
```

### 기성

```sql
CREATE TABLE 기성 (
  id              SERIAL PRIMARY KEY,
  수주_id         INTEGER NOT NULL REFERENCES 수주(id),
  차수            INTEGER NOT NULL,
  기성일          DATE,
  기성액_공급가   DECIMAL(15,2),
  생성자          INTEGER REFERENCES 사용자(id),
  생성일          TIMESTAMP DEFAULT NOW(),
  UNIQUE (수주_id, 차수)
);
```

### 투입실적

```sql
CREATE TABLE 투입실적 (
  id              SERIAL PRIMARY KEY,
  수주_id         INTEGER NOT NULL REFERENCES 수주(id),
  투입일          DATE NOT NULL,
  상용직_주       DECIMAL(5,2) DEFAULT 0,
  상용직_야       DECIMAL(5,2) DEFAULT 0,
  일용직_주       DECIMAL(5,2) DEFAULT 0,
  일용직_야       DECIMAL(5,2) DEFAULT 0,
  모범신호수_주   DECIMAL(5,2) DEFAULT 0,
  모범신호수_야   DECIMAL(5,2) DEFAULT 0,
  w6_주           DECIMAL(5,2) DEFAULT 0,
  w6_야           DECIMAL(5,2) DEFAULT 0,
  w3_주           DECIMAL(5,2) DEFAULT 0,
  w3_야           DECIMAL(5,2) DEFAULT 0,
  덤프15t_주      DECIMAL(5,2) DEFAULT 0,
  덤프15t_야      DECIMAL(5,2) DEFAULT 0,
  크레인_주       DECIMAL(5,2) DEFAULT 0,
  크레인_야       DECIMAL(5,2) DEFAULT 0,
  물청소차_주     DECIMAL(5,2) DEFAULT 0,
  물청소차_야     DECIMAL(5,2) DEFAULT 0,
  mcm_주          DECIMAL(5,2) DEFAULT 0,
  mcm_야          DECIMAL(5,2) DEFAULT 0,
  재료비인_주     DECIMAL(5,2) DEFAULT 0,
  재료비인_야     DECIMAL(5,2) DEFAULT 0,
  접속_주         DECIMAL(5,2) DEFAULT 0,
  접속_야         DECIMAL(5,2) DEFAULT 0,
  외주1           DECIMAL(15,2) DEFAULT 0,
  외주2           DECIMAL(15,2) DEFAULT 0,
  생성자          INTEGER REFERENCES 사용자(id),
  생성일          TIMESTAMP DEFAULT NOW(),
  수정자          INTEGER REFERENCES 사용자(id),
  수정일          TIMESTAMP,
  UNIQUE (수주_id, 투입일)
);
```

### 시스템설정 / 계획금액

```sql
CREATE TABLE 시스템설정 (
  키    VARCHAR(50) PRIMARY KEY,
  값    VARCHAR(100) NOT NULL,
  설명  TEXT
);
INSERT INTO 시스템설정 VALUES ('일반관리비율', '0.06', '투입금액에 대한 일반관리비 비율');

CREATE TABLE 계획금액 (
  년월      VARCHAR(7) PRIMARY KEY,  -- 'YYYY-MM'
  금액      DECIMAL(15,2) NOT NULL,
  입력자    UUID REFERENCES 사용자(id),
  생성일    TIMESTAMP DEFAULT NOW()
);
```

---

## 4. 핵심 계산 로직

### 수주 금액

```
수주금액_부가세     = 공급가 × 0.1
수주금액_보험료제외 = 공급가 × (1 - 보험료율)
수주금액_하도적용   = 보험료제외 × 하도전용율   ← 공급가 아닌 보험료제외액에 곱함
```

### 투입실적 금액

```
직접노무비 = Σ(직종_주 × 주간단가) + Σ(직종_야 × 야간단가)
재료비     = (재료비인_주 + 재료비인_야) × 161,000
투입금액   = 직접노무비 + 재료비 + 외주1 + 외주2   (calc투입금액)
합계       = 투입금액 × 1.06                        (calc합계)
```

> 단가는 투입일 기준 가장 최근 공사단가 레코드 적용

### 손익 집계 (공사이력 기반 — 진행기준 수익인식)

```
성과금액 = Σ 공사이력.성과금액  (작업일자 기준 월 필터)
투입금액 = Σ calc합계(투입실적)  (투입일 기준 월 필터)
손익금액 = 성과금액 - 투입금액
```

> 기성 테이블은 누적기성 조회용으로만 유지. 성과금액 소스는 공사이력.

### 공사이력 성과금액 계산

```
하도적용금액 = 공급가 × (1 - 보험료율) × 하도전용율
Δ달성률     = 해당일 달성률 - 전일 달성률  (단조증가만, 감소/정체 스킵)
성과금액     = Δ달성률 / 100 × 하도적용금액
```

---

## 5. 화면 목록

**UI 패턴:** `DataTable + Sheet` — 별도 페이지 없이 행 클릭 → Sheet에서 조회·수정·삭제, "새 등록" → 빈 Sheet

### 구현 완료

| URL | 화면 | 상태 |
|-----|------|------|
| `/` | 대시보드 홈 | ✅ |
| `/orders` | 수주대장 (목록·상세·등록·수정·삭제) | ✅ |
| `/input` | 투입실적 입력 | ✅ |
| `/input?tab=history` | 투입실적 현황 (조회·수정·삭제) | ✅ |
| `/sales` | 매출손익 현황 | ✅ |
| `/admin/clients` | 거래처 관리 (목록·등록·수정·삭제) | ✅ |
| `/admin/rates` | 공사단가 관리 (현행 단가·인라인 수정·추가·삭제) | ✅ |

### 구현 예정 (우선순위 순)

| URL | 화면 | 방식 |
|-----|------|------|
| `/orders` Sheet 탭 | 공사이력 조회·등록·수정·삭제 | Sheet 내 탭 추가 |
| `/orders` Sheet | 기성 등록 | Sheet 내 탭 |

---

## 6. 개발 로드맵

**Phase 2 (현재):** CRUD 완성
1. 공사이력 조회·등록·수정·삭제
2. 거래처 관리
3. 공사단가 관리

**Phase 3:** 권한 관리, REST API 공개, yjsboard.com 연동, EMAX 완전 대체

---

## 7. yjsboard.com과의 관계

```
yjsboard.com (포트 8000)  — 기존 대시보드 (Python FastAPI + SQLite)
erp.yjsboard.com (포트 3001) — 새 ERP (Next.js + Supabase)
```

**연동 전략:** Supabase REST API를 기존 대시보드의 새 데이터 소스로 활용.  
`anon` 역할에 SELECT 전용 RLS 정책으로 대시보드에서 인증 없이 읽기 가능.

---

## 8. 디자인 시스템

**컬러:**

```css
--sidebar-bg: #1e2d5a;      --sidebar-active-bg: #2d45a8;
--primary: #3d5af1;         --success: #22c55e;
--warning: #f59e0b;         --danger: #ef4444;
--bg-page: #f1f4fb;         --bg-card: #ffffff;
```

**차트:** 성과(파랑 #3d5af1) / 투입(주황 #f59e0b) / 손익(초록 #22c55e, 손실 빨강 #ef4444)

**레이아웃:** 사이드바(240px 고정) + 콘텐츠 영역 / 모바일(768px 미만) → 하단 탭바

---

## 9. 데이터 마이그레이션 현황

| 대상 | 스크립트 | 결과 |
|------|---------|------|
| 수주 | `scripts/migrate-수주.ts` | 518건 UPSERT 완료 |
| 기성 | (migrate-수주.ts 내) | 192건 (누적기성 M열 기준) |
| 투입실적 | `scripts/migrate-투입실적.ts` | 312건 완료 |
| 공사이력 | `scripts/migrate-공사이력.ts` | 263건 완료 |
| 거래처 | SQL INSERT | 24개 완료 |

---

## 10. 미확인 사항

- [ ] 일반관리비율 6%가 수주별로 다를 수 있는지 (현재 전체 동일 관찰)
- [ ] 기성과 준공 금액 관계 (준공액이 마지막 기성인지 별도 정산인지)
- [ ] 자재관리, 안전보건관리 메뉴 필요 여부
- [ ] 사용자 계정 수 및 권한 구조
