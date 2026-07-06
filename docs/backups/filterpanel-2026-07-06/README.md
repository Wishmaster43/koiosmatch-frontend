# Backup — filter panel BEFORE the wide/regrouped redesign (2026-07-06)

Pre-redesign copies of every file the filter-panel rework touches (width 240→320,
open checkbox groups, active-filter chips row, candidate regrouping, radius block).

Restore: copy a `.bak` back over the original path (strip the `.bak` suffix), e.g.
  cp docs/backups/filterpanel-2026-07-06/ReportFilterSidebar.tsx.bak src/components/reports/ReportFilterSidebar.tsx
Or revert the whole redesign with git: the commit is tagged "feat(filters)" on 2026-07-06.
