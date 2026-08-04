# Backup Inventory

Last updated: 2026-08-04

This inventory separates private source data, reproducible engineering evidence,
and public portfolio material. The current repository contains real business
data in Excel source files, so public artifacts must be anonymized or aggregated.

## Data Classification

| Tier | Location | Git policy | Contents | Public use |
| --- | --- | --- | --- | --- |
| Private source | `backups/private/`, local root Excel files, `.env.local` | Ignore; do not commit | Raw ERP Excel exports, Supabase dumps, service-role driven migration logs, row-level failure reports | Never |
| Reproducible evidence | `backups/reproducible/`, `scripts/`, `supabase/`, validation docs | Commit only non-secret process and templates | Migration scripts, schema notes, aggregate checks, workbook metadata without row values | Internal/demo-safe after review |
| Portfolio evidence | `backups/portfolio/`, `docs/portfolio-case-study.md` | Commit only anonymized material | Case study, synthetic samples, masked screenshots, aggregate metrics | Yes, after manual review |

## Current Source Inventory

> 2026-08-04 기준: 아래 엑셀 파일들은 **레포에 더 이상 없다.** 초기 이관이 끝난 뒤
> 레포 밖 개인 폴더로 옮겼다. 표는 이관 당시 원본이 어떤 모양이었는지에 대한
> 기록으로만 남긴다.

The workbook metadata below uses sheet names, row counts, column counts, and
headers only. Do not paste row values into public docs.

| Source file | Rows | Columns | Main headers | Sensitivity |
| --- | ---: | ---: | --- | --- |
| `거래처 데이터.xlsx` | 24 | 4 | 거래처코드, 거래처명, 보험료제외율, 하도적용율 | Private: customer/vendor identity and rate terms |
| `공사현황.xlsx` | 302 | 7 | 지중No, 작업일자, 달성률, 공사명, 성과금액, 투입금액, 손익금액 | Private: project identity and row-level financials |
| `매출손익.xlsx` | 354 | 16 | 지중No, 공사명, 구분, 1월-12월, 합계 | Private: project identity and monthly financials |
| `수주대장조회.xlsx` | 529 | 52 | 지중No, 공사번호, 공사명, 작업구분, 담당자, 감독자, 착공일, 발주자, 원청사, 현장, 금액/rate columns | Private: customer, project, site, person, contract terms |
| `투입실적현황.xlsx` | 334 | 29 | 지중No, 투입일, labor/equipment/material inputs, 투입금액, 관리비, 합계 | Private: project-level cost and operation records |

## Existing Process Assets

| Asset | Purpose | Public-safe? | Notes |
| --- | --- | --- | --- |
| `scripts/migrate-*.ts` | Imports Excel source data to Supabase tables | Partially | **2026-08-04 아카이브(전 줄 주석처리, 실행 불가).** 이관은 끝났고 원본 엑셀도 레포에 없다. 이관 방식의 근거로만 보관 |
| `scripts/check-신구비교.ts` | Compares legacy ERP totals with Supabase totals | No as-is | Contains row-level project codes and amounts; keep private or rewrite to aggregate before sharing |
| `scripts/failed_rows.json` | Migration failure diagnostics | No | Treat as private row-level evidence |
| `supabase/*.sql` | Whitelist/auth support schema | Partially | Review for table names and policies; never include real whitelist values |
| `.env.local` | Runtime secrets | No | Must never be committed or copied into evidence folders |

## Backup Structure

Recommended local structure:

```text
backups/
  private/
    2026-06-17-123555-data-backup/
      2026-06-17.backup.xlsx
      manifest.json
      workbook-inventory.json
    2026-06-17-supabase-dump/
    2026-06-17-migration-logs/
  reproducible/
    README.md
    generated/
      workbook-inventory.generated.json
      validation-summary.generated.md
  portfolio/
    README.md
    generated/
      anonymized-dashboard.png
      synthetic-sample-data.json
```

Only README/process files are intended for git. Generated folders are ignored by
default and should be promoted manually only after review.

## Automated Local Backup (폐지 — 2026-08-04)

로컬 엑셀 원본을 매일 묶던 백업(`npm run backup:data`, 윈도우 예약 작업
"YJS ERP Daily Data Backup", `scripts/backup-data.ts` /
`scripts/backup-inventory.ts` / `scripts/register-daily-backup.ps1`)은 제거했다.
지난 백업 산출물 `backups/private/<timestamp>-data-backup/` 은 그대로 둔다.

폐지 이유와, 폐지 전에 남긴 교훈:

- 이 백업이 지키던 대상은 루트의 구ERP 엑셀 원본인데, 초기 이관이 끝난 뒤
  그 파일들은 레포 밖으로 옮겨졌다. 지킬 대상이 없어졌다.
- **2026-07-06 이후 이 작업은 매일 실패하고 있었고 한 달 동안 아무도 몰랐다.**
  원인은 소스 파일 4개 중 `수주대장조회.xlsx` 가 사라지고 `매출손익.xlsx` 의
  이름이 바뀐 것. 스크립트는 `process.exit(1)` 로 제대로 실패했지만, 새벽 2시에
  아무도 안 보는 콘솔에서 실패했다(마지막 성공 백업 = 2026-07-06,
  2026-08-04 실행 결과 `LastTaskResult=1`).
- 교훈: 백업은 "돌게 만들었다"가 아니라 **"실패했을 때 내가 알게 되는가"**
  까지 가야 완성이다. 아래 DB 백업은 `backups/private/db-backup.log` 에 기록을
  남기지만, 실패를 사람에게 **밀어서 알리는** 경로는 아직 없다.

되살릴 일이 생기면 git 히스토리에서 위 세 스크립트를 꺼내면 된다.

## Automated Supabase DB Backup

라이브 Supabase DB는 별도로 매일 백업한다(소스 엑셀 백업과 무관).

```bash
npm run backup:db
```

- 방식: `supabase db dump` → gzip → `backups/private/<ts>-db-backup/<ts>-db.sql.gz`
- 이중 보관: VPS 로컬 + Supabase Storage `db-backups`(비공개) 버킷
- 보관주기: 일 7개 + 일요일자 주간 4개(로컬·Storage 동일)
- 필요 env: `SUPABASE_DB_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- 스케줄: VPS cron(`deploy/backup-db.cron.example`)
- 복원: `docs/runbook-db-restore.md`
- 로그: `backups/private/db-backup.log`

`supabase/storage-db-backups.sql` 을 Supabase SQL Editor에서 1회 실행해 버킷을 만들어야 한다.

## Minimum Evidence Set

For a complete private audit trail:
- Raw Excel files with timestamp and checksum.
- Supabase schema or dump created after migration.
- Exact migration command log.
- Validation report comparing source counts and aggregate totals.
- Known exception list with owner, reason, and decision.

For a public portfolio:
- Case study with architecture, constraints, and outcomes.
- Screenshots with all real names, project codes, and values masked.
- Synthetic or bucketed data only.
- Aggregate validation statement such as "source row counts reconciled across 5 workbooks" without customer-specific rows.

## Safety Rules

- Do not publish raw Excel files, `.env*`, service-role keys, whitelist exports,
  failure rows, or Supabase dumps with real data.
- Mask names, project codes, phone numbers, emails, addresses, exact dates when
  identifying, and row-level financials before any portfolio use.
- Prefer synthetic sample data. If real-derived aggregate values are used, bucket
  or round them enough that individual jobs cannot be reconstructed.
- Stop publication review if a screenshot or document contains a real 거래처,
  공사명, 현장명, 담당자, 감독자, 전화번호, 이메일, 주소, 지중No, or exact row-level amount.
