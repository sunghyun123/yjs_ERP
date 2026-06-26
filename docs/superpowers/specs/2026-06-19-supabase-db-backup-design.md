# Supabase DB 백업 자동화 — 설계 스펙

- 작성일: 2026-06-19
- 상태: 승인됨 (구현 대기)
- 관련: 운영 점검 1순위 — "라이브 Supabase DB가 백업·복구 불가" 공백 해소

## 1. 배경 & 목표

현재 백업 자동화는 마이그레이션 **소스 엑셀**(`scripts/backup-data.ts`)만 대상으로 한다.
실제 운영 데이터는 Supabase(PostgreSQL)에 있고, ERP에서 매일 입력되는 라이브
데이터(투입실적, 공무, 수주 변경분 등)는 어디에도 백업되지 않는다. 이 스펙은
**라이브 Supabase DB를 매일 자동 백업하고, VPS 단일 장애점을 해소하며, 검증된
복원 절차를 문서화**하는 것을 목표로 한다.

### 목표 (In scope)
- `supabase db dump`로 스키마+데이터 전체 SQL 백업을 매일 생성한다.
- 백업을 VPS 로컬 + Supabase Storage(`db-backups` 버킷)에 이중 보관한다.
- 보관주기(일 7 + 주 4)를 로컬·Storage 양쪽에 동일하게 적용한다.
- 복원 런북을 문서화하고 최소 1회 복원 검증을 권고한다.

### 비목표 (Out of scope)
- 외부 클라우드(S3/R2) 오프사이트 — 향후 확장 여지만 남긴다.
- 시점 복구(PITR) — Supabase 플랜 기능이며 본 스펙 범위 밖.
- 장애 알림(다운 통지) — 운영 점검 5번 별도 작업. 단, 본 스펙은 비0 종료 코드로
  향후 cron 실패 통지에 연동 가능하도록 한다.

## 2. 결정 사항 (확정)

| 항목 | 결정 | 비고 |
| --- | --- | --- |
| 백업 방식 | `supabase db dump` (Supabase CLI) | 설치 1개로 완전 복원 가능한 SQL |
| 구현 형태 | 순수 TS 스크립트 + `npm run backup:db` | 기존 `scripts/backup-*.ts` 패턴 일치 |
| 실행 환경 | VPS cron (매일 03:00) | 24/7 가동, PC 의존 제거 |
| 보관 위치 | VPS 로컬 + Supabase Storage `db-backups` | 추가 비용 0 |
| 보관주기 | 일 7 + 주(일요일) 4 | 로컬·Storage 동일 적용 |

### 알려진 한계 (의도적 수용)
Supabase Storage는 **같은 Supabase 프로젝트 내부**이므로 DB와 완전히 분리된
오프사이트가 아니다. Supabase 계정/프로젝트 자체 사고에는 취약하다. VPS 단일
장애점은 해소하되, 외부 클라우드 확장은 후속 과제로 남긴다. 보관 정리 로직은
업로드 대상(destination)에 무관한 순수 함수로 분리해 S3/R2 추가 시 재사용한다.

## 3. 아키텍처 & 산출물

```
scripts/backup-db.ts              # npm run backup:db — 메인 오케스트레이터 (순수 TS)
scripts/lib/storage-retention.ts  # 보관주기 판정 순수 함수 (단위 테스트 대상)
scripts/lib/storage-retention.test.ts  # vitest 단위 테스트
supabase/storage-db-backups.sql   # private 버킷 + service-role 전용 정책 (1회 실행)
docs/runbook-db-restore.md        # 복원 절차 런북 (recovery)
deploy/backup-db.cron.example     # VPS crontab 예시
.env.production.example           # SUPABASE_DB_URL 항목 추가
package.json                      # "backup:db" 스크립트 추가
```

### 컴포넌트 책임

**`scripts/backup-db.ts`** — 오케스트레이터. 순서:
1. 사전 점검: `supabase` CLI 존재 확인, `SUPABASE_DB_URL`·`SUPABASE_SERVICE_ROLE_KEY`·
   `NEXT_PUBLIC_SUPABASE_URL` 환경변수 존재 확인. 누락 시 명확한 메시지로 `exit(1)`.
2. `supabase db dump --db-url "$SUPABASE_DB_URL" -f <ts>.sql` 실행
   (대상: `backups/private/<ts>-db-backup/`).
3. dump 결과가 0바이트면 실패 처리. gzip 압축 → `<date>.sql.gz`, 원본 `.sql` 삭제.
4. sha256 계산, `manifest.json` 작성(dump 옵션, 크기, 체크섬, 소요시간, generatedAt).
5. Supabase Storage `db-backups` 버킷에 `<date>.sql.gz` 업로드(admin 클라이언트).
6. 보관주기 정리: `storage-retention.ts`로 로컬·Storage 각각 `{keep, delete}` 판정 후 삭제.
   **업로드 성공 후에만** prune 수행.
7. `backups/private/LATEST_DB_BACKUP.txt` 갱신.
8. `backups/private/db-backup.log`에 결과 1줄 append.

**`scripts/lib/storage-retention.ts`** — 외부 의존 없는 순수 함수.
- 시그니처: `selectForRetention(fileNames: string[], now: Date, policy: {dailyDays: number, weeklyCount: number}): { keep: string[], delete: string[] }`
- 파일명에서 날짜 파싱(`YYYY-MM-DD-HHMMSS-db.sql.gz`).
- 규칙: 최근 `dailyDays`(7)일 내 전부 보관 → 그보다 오래된 것 중 일요일자 최신 `weeklyCount`(4)개 보관 → 나머지 삭제.

**`supabase/storage-db-backups.sql`** — Storage 버킷 `db-backups`를 **비공개**로 생성,
public 접근 차단. service-role만 읽기/쓰기(서버 측 키 사용이므로 RLS 정책 불필요하나
버킷이 public이 되지 않도록 명시).

## 4. 데이터 흐름

```
cron(03:00) → npm run backup:db
  → supabase db dump (SUPABASE_DB_URL)  → <ts>.sql
  → gzip                                 → <date>.sql.gz (+sha256)
  → manifest.json
  → Storage 업로드 (db-backups 버킷)
  → prune 로컬 (selectForRetention)
  → prune Storage (selectForRetention)
  → LATEST_DB_BACKUP.txt + db-backup.log
  → exit 0 (성공) / exit 1 (실패)
```

## 5. 에러 처리 & 로깅

- **단계별 fail-fast**: CLI 미설치 / 환경변수 누락 / dump 0바이트 / 업로드 실패 →
  각각 구체적 메시지와 함께 `exit(1)`.
- **부분 실패 정책**: dump 성공 + 업로드 실패 시 → 로컬 백업은 **보존**, prune은
  **건너뛰고** 비0 종료. 검증되지 않은 상태로 과거 백업을 지우지 않는다.
- **로그 포맷**(`backups/private/db-backup.log`, append):
  `[YYYY-MM-DD HH:mm:ss] OK|FAIL | <file> | <bytes> | <sha256-앞12> | <소요ms> | upload:Y|N`
- **종료 코드**: 성공 0 / 실패 1 → 운영 점검 5번(장애 알림)에서 cron 실패 통지에 활용.

## 6. 보안 & 민감도

- dump 파일은 `backups/private/`(이미 gitignore)에만 생성. git 추적 금지.
- `SUPABASE_DB_URL`·service-role 키는 `.env.production`(git 비추적). `.example`에는
  플레이스홀더만.
- Storage `db-backups` 버킷은 비공개. 공개 URL 노출 금지.
- 기존 `docs/backup-inventory.md`의 안전 규칙(원본/덤프 공개 금지)을 그대로 따른다.

## 7. 테스트 전략

- **단위 테스트**(vitest): `storage-retention.test.ts`
  - 정확히 7일 경계, 8일째(일요일이면 주간으로 승격), 일요일 5개째(4개 초과분 삭제),
    빈 목록, 파싱 불가 파일명 무시, 미래 날짜.
- **수동 1회 검증**(구현 후, 실제 자격증명 필요 → 사용자 실행):
  VPS에서 `npm run backup:db` 1회 → 로컬 파일 / Storage 객체 / 로그 1줄 생성 확인.
- **복원 검증**: 런북 절차대로 최소 1회 복원 테스트(백업 유효성 확인) 권고.

## 8. 복원 런북 (`docs/runbook-db-restore.md` 요지)

1. Storage 또는 로컬에서 대상 `<date>.sql.gz` 확보, sha256를 manifest와 대조.
2. `gunzip <date>.sql.gz`
3. `psql "$SUPABASE_DB_URL" -f <date>.sql` (또는 staging 프로젝트에 먼저 복원 후 검증)
4. 복원 후 핵심 테이블 행 수 / 합계를 백업 시점과 대조.
5. **분기 1회**는 staging에 복원 테스트해 백업이 실제로 살아있는지 검증.

## 9. 구현 순서 (요약)

1. `scripts/lib/storage-retention.ts` + 테스트 (TDD)
2. `supabase/storage-db-backups.sql` 버킷 생성 SQL
3. `scripts/backup-db.ts` 오케스트레이터
4. `package.json` `backup:db` 스크립트 + `.env.production.example` 갱신
5. `deploy/backup-db.cron.example` + `docs/runbook-db-restore.md`
6. 문서: `docs/backup-inventory.md`에 DB 백업 절차 한 단락 추가
