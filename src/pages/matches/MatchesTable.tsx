import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import Avatar from '@/components/ui/Avatar'
import StatusPill from '@/components/ui/StatusPill'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import ScorePill from './ScorePill'
import type { MatchRow } from '@/types/match'
import type { Id } from '@/types/common'

interface MatchesTableProps {
  rows: MatchRow[]
  loading?: boolean
  error?: boolean
  stickyHeader?: boolean
  scrollParentRef?: RefObject<HTMLElement | null>
  // Row click opens the read-only detail drawer (§3A drill-down).
  onRowClick?: (row: MatchRow) => void
  // Highlight the row whose drawer is open.
  selectedId?: Id | null
  // Bulk selection (checkboxes) — mirrors every other entity table.
  selectable?: boolean
  selectedIds?: Set<Id>
  onToggleRow?: (id: Id) => void
  onToggleAll?: (ids: Id[], allSelected: boolean) => void
}

// MatchesTable — declares columns only; the shared DataTable owns sorting + states.
export default function MatchesTable({
  rows, loading, error, stickyHeader = false, scrollParentRef, onRowClick,
  selectedId, selectable, selectedIds, onToggleRow, onToggleAll,
}: MatchesTableProps) {
  const { t } = useTranslation('matches')
  // Match lifecycle lookup (R-1b) — resolves the status chip label/colour.
  const { metaOf: statusMeta } = useMatchStatuses()

  // MATCH-APPROVAL-1: no dedicated approval_status column here on purpose — the
  // row already carries one status-shaped chip (the "stage" column above) and adding
  // a second soft chip would crowd a 7-column table with two overlapping "status"
  // reads. The approval badge lives in the drawer title instead (§3A calm header);
  // revisit only if Danny asks for it at the list level too.
  const columns: Column<MatchRow>[] = [
    { key: 'candidate', header: t('cols.candidate'), sortable: true,
      render: r => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar initials={r.initials} size={24} />
          <span style={{ fontWeight: 500, color: 'var(--text)' }}>{r.candidate}</span>
        </span>
      ) },
    { key: 'vacancy', header: t('cols.vacancy'), sortable: true, nowrap: false },
    { key: 'client',  header: t('cols.client'),  sortable: true, cellStyle: { color: 'var(--text-muted)' } },
    { key: 'score',   header: t('cols.score'), align: 'right', sortable: true,
      sortValue: r => r.score ?? -1, render: r => <ScorePill value={r.score} /> },
    { key: 'stage',   header: t('cols.status'),
      // Status axis (R-1b): resolve label+colour from the lookup; stage fell out of the resource.
      render: r => { const m = statusMeta(r.status); return m
        ? <StatusPill label={m.label} color={m.color} />
        : (r.stage ? <StatusPill label={r.stage} color={r.stageColor} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>) } },
    { key: 'owner',   header: t('cols.owner'), sortable: true, cellStyle: { color: 'var(--text-muted)' } },
    { key: 'date',    header: t('cols.date'),  sortable: true, cellStyle: { color: 'var(--text-muted)', fontSize: 12 } },
  ]

  return (
    <>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <DataTable columns={columns} rows={rows} loading={loading}
          loadingText={t('loading')} emptyText={error ? t('error') : t('empty')}
          stickyHeader={stickyHeader} scrollParentRef={scrollParentRef} onRowClick={onRowClick}
          selectedId={selectedId} selectable={selectable} selectedIds={selectedIds}
          onToggleRow={onToggleRow} onToggleAll={onToggleAll} />
      </div>
    </>
  )
}
