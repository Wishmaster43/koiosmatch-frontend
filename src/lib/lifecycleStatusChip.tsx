/**
 * lifecycleStatusChip — the shared "archive/trash wins over the status pill"
 * cell fragment (MATCH-ARCHIVED-LIST-1/ARCHIVE-1, mirrors VacanciesTable/
 * CandidatesTable; TRASH-OVERAL-2 for the pending-erase view). A soft-deleted
 * row shown via include_archived=1 reads as "Archived", never its stale status;
 * a trashed row reads as pending erase (danger). Returns null when neither
 * lifecycle state applies, so the caller falls through to its own status pill.
 * Hand-copied identically in matches/opportunities before this consolidation.
 */
import type { TFunction } from 'i18next'
import SoftChip from '@/components/ui/SoftChip'

interface LifecycleRow {
  lifecycle?: string | null
  archived?: boolean
}

export function lifecycleStatusChip(row: LifecycleRow, t: TFunction) {
  if (row.lifecycle === 'pending_erase') return <SoftChip label={t('common:trash.view')} color="var(--color-trash)" round />
  if (row.archived) return <SoftChip label={t('view.archived')} color="var(--text-muted)" round />
  return null
}
