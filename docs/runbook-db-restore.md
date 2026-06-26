# 런북: Supabase DB 복원

대상 백업은 `npm run backup:db`가 생성한 `YYYY-MM-DD-HHMMSS-db.sql.gz` (gzip된 `supabase db dump` 결과)이다.

## 1. 백업 확보 및 무결성 검증

로컬(VPS):
- 최신 위치: `backups/private/LATEST_DB_BACKUP.txt` 의 `path`, `sha256` 확인.

Supabase Storage(`db-backups` 버킷)에서 받기:
- 대시보드 → Storage → `db-backups` → 대상 파일 다운로드, 또는 service-role 키로 API 다운로드.

무결성 검증(해당 백업 폴더의 `manifest.json` 과 대조):

```bash
sha256sum 2026-06-19-030000-db.sql.gz   # manifest.json 의 sha256 과 일치해야 함
```

## 2. 압축 해제

```bash
gunzip -k 2026-06-19-030000-db.sql.gz   # -k: 원본 .gz 보존
```

## 3. 복원

> 운영 DB에 바로 복원하기 전, 가능하면 **별도(staging) Supabase 프로젝트나 로컬 Postgres**에 먼저 복원해 검증할 것.

```bash
# $SUPABASE_DB_URL 은 복원 대상 DB의 연결 문자열
psql "$SUPABASE_DB_URL" -f 2026-06-19-030000-db.sql
```

## 4. 복원 검증

핵심 테이블의 행 수/합계를 백업 시점과 대조:

```sql
select count(*) from "투입실적";
select count(*) from "수주";
select sum("성과금액") from "공사이력";   -- 컬럼명은 실제 스키마에 맞게 조정
```

## 5. 정기 복원 훈련 (중요)

**분기 1회**, 최신 백업을 staging에 복원해 백업이 실제로 살아있는지 검증한다.
한 번도 복원해보지 않은 백업은 "백업이 있다"고 말할 수 없다.
