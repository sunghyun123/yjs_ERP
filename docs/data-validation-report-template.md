# Data Validation Report Template

Report date:
Validator:
Source snapshot:
Supabase target:
Migration commands:

## Scope

| Source | Target table/process | Expected result | Status |
| --- | --- | --- | --- |
| `거래처 데이터.xlsx` | 거래처 master data | Source rows reconcile to imported client records | TBD |
| `수주대장조회.xlsx` | orders/projects and progress billing | Source rows reconcile to project records and 기성 rows | TBD |
| `공사현황.xlsx` | progress/history | Source rows reconcile to progress history after filtering rules | TBD |
| `투입실적현황.xlsx` | input/cost records | Source rows reconcile to input history and calculated costs | TBD |
| `매출손익.xlsx` | monthly sales/profit evidence | Aggregate monthly totals reconcile with ERP views | TBD |

## Pre-Run Checklist

- `.env.local` exists locally and is not committed.
- `SUPABASE_SERVICE_ROLE_KEY` is available only for private migration/validation.
- Raw Excel files are present in the private workspace.
- Existing target data backup or rollback point is available.
- Public output path is empty or contains only reviewed anonymized artifacts.

## Source Metadata

| File | Sheet | Source rows | Source columns | Notes |
| --- | --- | ---: | ---: | --- |
|  |  |  |  |  |

## Validation Checks

| Check | Method | Pass criteria | Result | Evidence path |
| --- | --- | --- | --- | --- |
| Workbook readability | 워크북 직접 열람 (`backup:inventory` 는 2026-08-04 제거) | All expected workbooks open and headers match inventory | TBD |  |
| Row count reconciliation | Migration script output plus DB count query | Difference is 0 or documented | TBD |  |
| Required field completeness | DB query for null/blank critical fields | No unexpected blanks | TBD |  |
| Referential integrity | DB query for missing client/project references | No unresolved foreign keys | TBD |  |
| Financial aggregate comparison | Legacy workbook totals vs Supabase aggregates | Difference within approved tolerance | TBD |  |
| Date range sanity | Min/max date query by imported table | No out-of-scope dates unless documented | TBD |  |
| Duplicate detection | Unique key/group-by query | No unexpected duplicate business keys | TBD |  |
| Public artifact scan | Manual review plus search for known real identifiers | No private names, codes, or row-level values | TBD |  |

## Exception Log

| ID | Source | Issue | Decision | Owner | Closed |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

## Aggregate Results

| Area | Source total | Target total | Difference | Notes |
| --- | ---: | ---: | ---: | --- |
| Clients/vendors |  |  |  |  |
| Projects/orders |  |  |  |  |
| Progress history |  |  |  |  |
| Input records |  |  |  |  |
| Monthly revenue |  |  |  |  |
| Monthly cost |  |  |  |  |
| Monthly profit |  |  |  |  |

## Sign-Off

Decision:

Approved for private backup:

Approved for reproducible evidence:

Approved for public portfolio:

Reviewer notes:
