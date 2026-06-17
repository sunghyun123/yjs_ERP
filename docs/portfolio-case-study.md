# Portfolio Case Study Draft

## Project

Internal construction ERP modernization for YJS.

## Problem

The business operated from legacy Excel/ERP exports containing customer, order,
progress, input-cost, and monthly profit data. The work required migrating that
data into a web ERP while preserving accounting meaning, improving day-to-day
operations, and keeping private business records out of public materials.

## Constraints

- Real customer, project, site, staff, and financial records are confidential.
- Migration had to reconcile legacy Excel exports with Supabase-backed views.
- Public portfolio evidence must use anonymized screenshots, synthetic samples,
  and aggregate validation only.
- Runtime secrets, service-role keys, and whitelist data must remain private.

## Technical Approach

- Built a Next 16 and Supabase ERP with dashboard, order, progress, input,
  sales/profit, admin, and auth workflows.
- Added TypeScript migration scripts for the legacy Excel sources.
- Used Supabase as the operational database with access controlled through the
  application and whitelist-driven auth.
- Added backup tiers for private source data, reproducible engineering evidence,
  and public portfolio evidence.
- Defined a validation report template covering row counts, required fields,
  referential integrity, duplicates, date ranges, and financial aggregates.

## Evidence Plan

| Evidence | Private proof | Public-safe substitute |
| --- | --- | --- |
| Raw source migration | Original Excel files and migration logs | Workbook inventory with row counts and headers only |
| Data correctness | Legacy vs Supabase aggregate comparison | Aggregate reconciliation statement with no row-level values |
| UI functionality | Real ERP screenshots | Synthetic dataset screenshots with masked identifiers |
| Operations readiness | Private backup and rollback notes | Backup structure and validation template |

## Outcomes To Fill After Review

- Imported source workbook count:
- Reconciled project/order rows:
- Reconciled progress/input rows:
- Known exceptions:
- Public screenshots reviewed:
- Synthetic sample generated:

## Public Narrative

I modernized a spreadsheet-driven construction ERP into a Supabase-backed web
application. The project included Excel migration, role-aware access, operational
dashboards, order/progress/input workflows, and validation checks to ensure the
new system matched legacy records. Because the source data contains real customer
and financial information, portfolio evidence is separated into anonymized and
synthetic artifacts with a documented review process.

## Publish Checklist

- Replace all real names, codes, sites, dates, and exact row-level amounts.
- Use synthetic screenshots or heavily masked captures.
- Include only aggregate validation statements.
- Confirm `.env*`, service-role keys, raw Excel files, Supabase dumps, and
  failure rows are absent from public assets.
