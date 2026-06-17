# Private Backup Tier

This directory is for local-only source backups that may contain customer, project,
site, staff, pricing, revenue, cost, or authentication-related data.

Do not commit files in this tier. Keep only this README in git.

Allowed examples:
- Raw Excel exports from the legacy ERP.
- Supabase dumps containing real rows.
- Migration failure reports with row-level identifiers.
- Operator notes that mention real customers, projects, people, or secrets.

Required handling:
- Store encrypted at rest when moved outside the workstation.
- Keep a timestamped folder name such as `2026-06-17-raw-excel/`.
- Record checksums in a private note or password manager, not in public docs if
  filenames reveal private business context.
- Never copy `.env.local`, service-role keys, or access tokens into this folder.
