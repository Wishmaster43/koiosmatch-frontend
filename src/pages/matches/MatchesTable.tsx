import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import Avatar from '@/components/ui/Avatar'
import StatusPill from '@/components/ui/StatusPill'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
import ScorePill from './ScorePill'
import type { MatchRow } from '@/types/match'
import type { Id } from '@/types/common'

// Neutral grey fallback (§3A owner-cell convention) when the mapper has no colour.
const NEUTRAL_AVATAR = '#9CA3AF'

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
  const { formatDate } = useDateFormat()
  // Match lifecycle lookup (R-1b) — resolves the status chip label/colour.
  const { metaOf: statusMeta } = useMatchStatuses()
  // Tenant display settings (Settings → Matches → Tabelweergave). Coloured chips ON
  // by default, mirrors candidates/applications.
  const settings = useAllSettings()
  const colorStatus = getBoolSetting(settings, 'match_table_color_status', true)
  const colorOwner  = getBoolSetting(settings, 'match_table_color_owner', true)

  // MATCH-APPROVAL-1: no dedicated approval_status column here on purpose — the
  // row already carries one status-shaped chip (the "stage" column above) and adding
  // a second soft chip would crowd a 7-column table with two overlapping "status"
  // reads. The approval badge lives in the drawer title instead (§3A calm header);
  // revisit only if Danny asks for it at the list level too.
  // Column order mirrors the candidates blueprint (§3A): identity → phase/status →
  // dates → owner LAST (Danny 2026-07-14 table standardization).
  const columns: Column<MatchRow>[] = [
    // Candidate — soft avatar + name, sticky first column (mirrors candidates/applications).
    { key: 'candidate', header: t('cols.candidate'), sortable: true,
      sticky: true, width: 200, nowrap: true,
      render: r => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Avatar initials={r.initials} size={24} soft />
          <span style={{ fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 150 }} title={r.candidate}>{r.candidate}</span>
        </span>
      ) },
    { key: 'vacancy', header: t('cols.vacancy'), sortable: true, nowrap: false },
    { key: 'client',  header: t('cols.client'),  sortable: true, cellStyle: { color: 'var(--text-muted)' } },
    { key: 'score',   header: t('cols.score'), align: 'right', sortable: true,
      sortValue: r => r.score ?? -1, render: r => <ScorePill value={r.score} /> },
    { key: 'stage',   header: t('cols.status'),
      // Status axis (R-1b): resolve label+colour from the lookup; stage fell out of the resource.
      render: r => {
        const m = statusMeta(r.status)
        const label = m?.label ?? r.stage
        const color = m?.color ?? r.stageColor
        if (!label) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        return colorStatus ? <StatusPill label={label} color={color} /> : <span style={{ color: 'var(--text)', fontSize: 12 }}>{label}</span>
      } },
    // Raw ISO from the API → locale format (Danny 2026-07-13: "datum staat raar").
    { key: 'date',    header: t('cols.date'),  sortable: true, sortValue: r => r.date,
      cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, render: r => r.date ? formatDate(r.date) : '—' },
    // Owner — avatar + name, colour if the mapper resolved one AND the toggle is on,
    // else neutral grey. LAST column (§3A convention).
    { key: 'owner', header: t('cols.owner'), sortable: true, sortValue: r => r.owner,
      render: r => r.owner ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Avatar initials={r.ownerInitials} size={18} color={colorOwner ? (r.ownerColor || NEUTRAL_AVATAR) : NEUTRAL_AVATAR} soft />
          <span style={{ fontSize: 12, color: 'var(--text)' }}>{r.owner}</span>
        </span>
      ) : <span style={{ color: 'var(--text-muted)' }}>—</span> },
  ]

  // No surface-card wrapper: the DataTable renders directly on the page background,
  // like every other entity table (mirrors candidates/applications/opportunities —
  // Danny 2026-07-14: the unique card wrapper here made this table look different).
  return (
    <DataTable columns={columns} rows={rows} loading={loading}
      loadingText={t('loading')} emptyText={error ? t('error') : t('empty')}
      stickyHeader={stickyHeader} scrollParentRef={scrollParentRef} onRowClick={onRowClick}
      selectedId={selectedId} selectable={selectable} selectedIds={selectedIds}
      onToggleRow={onToggleRow} onToggleAll={onToggleAll} />
  )
}
