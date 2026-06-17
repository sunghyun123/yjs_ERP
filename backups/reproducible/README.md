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

Recommended flow:
1. Run `npm run backup:inventory` to inspect workbook structure.
2. Save generated inventory to `backups/reproducible/generated/` for private
   handoff, or summarize it manually in `docs/backup-inventory.md`.
3. Run migration and validation scripts from `scripts/`.
4. Fill out `docs/data-validation-report-template.md` with aggregate results.
