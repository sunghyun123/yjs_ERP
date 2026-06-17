# Anonymized Sample Data Plan

Use synthetic data for portfolio demos. Real-derived data may be used only after
the transformation makes individual customers, projects, people, sites, and exact
financial rows unrecoverable.

## Field Handling Rules

| Field type | Private example category | Portfolio replacement |
| --- | --- | --- |
| 거래처명, 발주자, 원청사 | Real company/customer names | `거래처 A`, `발주처 01`, or generated industry-neutral names |
| 공사명, 공사현장 | Real project/site names | `상수도 정비 공사 001`, `현장 A` |
| 지중No, 공사번호 | Business identifiers | Deterministic synthetic IDs such as `DEMO-2026-001` |
| 담당자, 감독자, 관리자 | Personal names | Role labels such as `담당자 1` |
| 전화번호, 이메일, 주소 | Direct identifiers | Remove, blank, or replace with reserved examples like `010-0000-0000` |
| 작업일자, 착공일, 준공일 | Potentially identifying dates | Shift by a fixed private offset or month-bucket |
| 금액, 성과, 투입, 손익 | Financial rows | Use synthetic values preserving rough ratios, or bucket/round aggregates |
| 비고, 참고사항 | Free text | Remove unless manually rewritten |

## Synthetic Generation Rules

1. Generate 20-40 projects across 3-5 synthetic customers.
2. Preserve ERP workflow states: active, completed, settled, unsettled.
3. Keep realistic relationships: project amount >= cumulative progress, input
   costs connected to project/date, profit = revenue - input.
4. Use rounded amounts such as 1,000,000 increments; avoid copying exact source
   amounts.
5. Use fake dates within a demo year and avoid matching real project timelines.
6. Keep only aggregate validation evidence in public docs.

## Review Checklist

- No raw Excel data was copied.
- No real customer, project, site, or person name appears.
- No real business identifier such as actual `지중No` appears.
- No exact row-level amount from source workbooks appears.
- Screenshots do not show browser autocomplete, account emails, secrets, or URLs
  containing private tokens.
- The sample can be regenerated from documented rules without private files.

## Suggested Outputs

| Output | Location | Notes |
| --- | --- | --- |
| Synthetic seed data | `backups/portfolio/generated/synthetic-sample-data.json` | Ignored until manually reviewed |
| Screenshot set | `backups/portfolio/generated/screenshots/` | Mask before publishing |
| Public case study | `docs/portfolio-case-study.md` | Keep implementation and outcomes, not private rows |

## Current Generator

Run:

```powershell
npm run backup:portfolio
```

This creates `backups/portfolio/generated/<yyyy-mm-dd>.portfolio-sample.xlsx`
with synthetic `공사현황`, `매출손익`, `수주대장조회`, and `투입실적현황`
sheets. The generator does not read private workbook rows.
