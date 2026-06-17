# Backup Inventory

Last updated: 2026-06-17

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
| `scripts/migrate-*.ts` | Imports Excel source data to Supabase tables | Partially | Script logic is useful; comments/output may include real identifiers during execution |
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

## Automated Local Backup

Create a private backup bundle now:

```powershell
npm run backup:data
```

Each run creates a new ignored folder:

```text
backups/private/<timestamp>-data-backup/
  <yyyy-mm-dd>.backup.xlsx
  manifest.json
  workbook-inventory.json
```

The backup workbook contains four operational sheets:
- `공사현황`
- `매출손익`
- `수주대장조회`
- `투입실적현황`

`거래처 데이터.xlsx` is intentionally excluded from the daily backup because it is
mostly static reference data. Keep it in a separate private snapshot when it
changes.

`manifest.json` contains source file names, sizes, checksums, output workbook
checksum, and the exclusion reason. `workbook-inventory.json` contains workbook
metadata only.

Register the daily Windows scheduled task:

```powershell
.\scripts\register-daily-backup.ps1 -Time "02:00"
```

The task runs `npm run backup:data` once per day and writes a new timestamped
folder under `backups/private/`.

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
