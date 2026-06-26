# Supabase DB 백업 자동화 — 재개 핸드오프

- 작성: 2026-06-19 (금, 퇴근 전 정리)
- 브랜치: `feat/supabase-db-backup` (보존됨, main 미병합)
- 상태: **구현·리뷰 완료. main 병합은 다음 주 실제 테스트 후 진행 예정.**

## 한 줄 요약

`npm run backup:db` 로 라이브 Supabase DB를 매일 백업(dump→gzip→manifest→Storage 업로드→보관주기 정리)하는 기능을 구현 완료했다. 코드/단위테스트/문서는 끝났고, **실제 자격증명이 필요한 운영 검증(2·3단계)만 남았다.**

## 지금까지 한 일 (브랜치에 커밋 완료)

7개 커밋 (`f06ccdb`=플랜 직후부터):

| SHA | 내용 |
| --- | --- |
| `40aacc5` | 보관주기 판정 순수 함수 + 단위 테스트 |
| `00dc6d9` | (리뷰 수정) 달력 유효성 검증 + 경계 테스트 보강 |
| `ed1df34` | `db-backups` 비공개 Storage 버킷 생성 SQL |
| `655df9d` | 백업 스크립트(`backup:db`) + env 항목 |
| `4a3a289` | (리뷰 수정) dump 실패 시 DB URL 노출 차단 + 잔여 디렉터리 정리 |
| `09e21e5` | cron 예시 + 복원 런북 + 인벤토리 갱신 |
| `1b0f0f8` | (하드닝) cron 로그 권한 제한 안내 + NEXT_PUBLIC URL 주석 |

생성/수정 파일:
- `src/lib/backup/storage-retention.ts` + `.test.ts` — 보관/삭제 판정 순수 함수 (테스트 8개)
- `scripts/backup-db.ts` — 오케스트레이터 (`npm run backup:db`)
- `supabase/storage-db-backups.sql` — 비공개 버킷 생성
- `deploy/backup-db.cron.example` — VPS cron 예시
- `docs/runbook-db-restore.md` — 복원 런북
- `docs/backup-inventory.md` — DB 백업 단락 추가
- `package.json` — `backup:db` 스크립트
- `.env.production.example` — `SUPABASE_DB_URL` 항목

스펙: `docs/superpowers/specs/2026-06-19-supabase-db-backup-design.md`
플랜: `docs/superpowers/plans/2026-06-19-supabase-db-backup.md`

리뷰 결과: 각 태스크 2단계 리뷰 통과, 최종 홀리스틱 리뷰 **READY TO MERGE**.

## 다음 주에 할 일 (순서대로)

### 0. 브랜치 복귀
```bash
git checkout feat/supabase-db-backup
```

### 1단계 — 자동 테스트 재확인 (자격증명 불필요, 30초)
```bash
npx vitest run                              # 전체 18개 통과해야 함
npx tsc --noEmit -p scripts/tsconfig.json   # 타입 에러 없어야 함
```

### 2단계 — 실제 백업 1회 (자격증명 필요)
사전 준비:
1. `supabase --version` 확인 (없으면 `npm i -g supabase`)
2. Supabase 대시보드 → SQL Editor에서 `supabase/storage-db-backups.sql` **1회 실행** (비공개 버킷 생성). 이걸 안 하면 업로드가 "Bucket not found"로 실패함.
3. `.env.local`(로컬 테스트) 또는 VPS `.env.production`에 실제 값 입력:
   ```bash
   SUPABASE_DB_URL=postgresql://postgres:실제비번@db.프로젝트ID.supabase.co:5432/postgres
   # NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 는 기존 값 사용
   ```
   (연결 문자열: 대시보드 → Settings → Database → Connection string (URI))

실행:
```bash
npm run backup:db
```
성공 판정 (전부 충족):
- 콘솔 `✅ DB 백업 완료: ...`
- `backups/private/<날짜시각>-db-backup/` 에 `*.sql.gz` + `manifest.json`
- `backups/private/LATEST_DB_BACKUP.txt` 갱신
- `backups/private/db-backup.log` 에 `OK ... upload:Y` 한 줄
- 대시보드 → Storage → `db-backups` 버킷에 `.gz` 객체 존재
- 무결성: `sha256sum *.sql.gz` 값이 `manifest.json`의 sha256과 일치

### 3단계 — 복원 검증 (가장 중요)
`docs/runbook-db-restore.md` 절차대로 **staging/로컬 Postgres**에 1회 복원해 백업이 살아있는지 확인. ⚠️ 운영 DB에 직접 복원 금지, 별도 DB에서 먼저 검증.

### 4단계 — main 병합 + cron 등록
2·3단계가 OK면:
```bash
git checkout main && git pull && git merge feat/supabase-db-backup
npx vitest run            # 병합 결과에서도 테스트 통과 확인
git branch -d feat/supabase-db-backup
```
그 후 VPS에서 `deploy/backup-db.cron.example` 안내대로 crontab 등록 (타임존 주의: UTC면 KST 03:00 = `18 0 * * *`), 다음 날 로그 확인.

## 알려진 한계 / 메모
- Storage는 같은 Supabase 프로젝트 내부 → 프로젝트 자체 사고에는 취약. VPS 단일 장애점만 해소. 외부 클라우드(S3/R2)는 후속 과제 (retention 로직은 destination 무관 순수 함수라 재사용 가능).
- 최종 리뷰의 잔여 권고(비차단): `execFileSync`의 `stdio:'inherit'`로 CLI가 만에 하나 연결정보를 stderr에 남길 수 있어 cron 로그 디렉터리를 `chmod 700`으로 제한하도록 예시에 안내해 둠. 필요시 추후 stderr 버퍼링으로 강화 가능.
- 운영 점검 8개 항목 중 이건 **1번(백업)**만 해결. 나머지(로그/권한/복구/장애알림/수정이력/배포/문서화)는 별도 작업.
