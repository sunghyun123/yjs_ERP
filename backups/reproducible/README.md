# Reproducible Backup Tier

This directory is for non-secret artifacts that let another developer reproduce
the migration and validation process without seeing real business data.

Commit-safe contents:
- README files and process notes.
- Redacted schemas, migration command lists, and validation templates.
- Generated metadata that includes filenames, row counts, sheet names, column
  names, and checksums only when the filenames themselves are safe to disclose.

Do not commit generated row-level data here. Put generated files under
`generated/`; that folder is ignored by default.

> 2026-08-04: 초기 이관이 끝나 이 흐름은 더 이상 실행되지 않는다. 원본 엑셀은
> 레포 밖으로 옮겼고, `npm run backup:inventory` 와 `scripts/migrate-*.ts` 는
> 각각 제거·주석처리됐다. 아래는 당시 절차의 기록이다.

Recommended flow (당시):
1. Run `npm run backup:inventory` to inspect workbook structure.
2. Save generated inventory to `backups/reproducible/generated/` for private
   handoff, or summarize it manually in `docs/backup-inventory.md`.
3. Run migration and validation scripts from `scripts/`.
4. Fill out `docs/data-validation-report-template.md` with aggregate results.
