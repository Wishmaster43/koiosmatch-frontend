import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import Avatar from '@/components/ui/Avatar'
import EntityNameCell from '@/components/ui/EntityNameCell'
import StatusPill from '@/components/ui/StatusPill'
import CandidateStatusChip from '@/components/ui/CandidateStatusChip'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import type { Application } from '@/types/application'
import type { Id } from '@/types/common'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
import { useDateFormat } from '@/lib/datetime'

// Plain-text cell style (used when a colour toggle is off).
const plainCell = { color: 'var(--text)', fontSize: 12 }

// Match score as a soft-coloured percentage (green ≥75, amber ≥50, red below);
// `plain` renders it as neutral text when the colour toggle is off.
function ScorePill({ value, plain }: { value: number | null; plain?: boolean }) {
  if (value == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const c = plain ? 'var(--text)' : value >= 75 ? 'var(--color-success)' : value >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'
  return <span style={{ fontWeight: plain ? 400 : 600, fontSize: plain ? 12 : undefined, color: c }}>{value}%</span>
}

interface ApplicationsTableProps {
  rows: Application[]
  loading?: boolean
  error?: unknown
  selectedId?: Id | null
  onSelect?: (row: Application) => void
  stickyHeader?: boolean
  // Row selection (checkboxes) — driven by the page for the bulk action bar.
  selectable?: boolean
  selectedIds?: Set<Id>
  onToggleRow?: (id: Id) => void
  onToggleAll?: (ids: Id[], allSelected: boolean) => void
  // Virtualization (F-7): the vertical scroll container this table lives in —
  // opt-in, forwarded straight to DataTable (mirrors CustomersTable/VacanciesTable).
  scrollParentRef?: RefObject<HTMLElement | null>
}

/**
 * ApplicationsTable — declares columns only; the shared DataTable owns sorting,
 * selection, hover and the loading/empty states. Mirrors MatchesTable.
 */
export default function ApplicationsTable({ rows, loading, error, selectedId, onSelect, stickyHeader = false,
  selectable, selectedIds, onToggleRow, onToggleAll, scrollParentRef }: ApplicationsTableProps) {
  const { t } = useTranslation('applications')
  const { formatDate } = useDateFormat()
  // Tenant display settings (Settings → Applications → Table display). Coloured
  // chips/score vs. plain text — one flag PER meaning-carrying column; all ON by default.
  const settings = useAllSettings()
  const colorScore  = getBoolSetting(settings, 'application_table_color_score', true)
  const colorPhase  = getBoolSetting(settings, 'application_table_color_phase', true)
  const colorStatus = getBoolSetting(settings, 'application_table_color_status', true)
  const colorOwner  = getBoolSetting(settings, 'application_table_color_owner', true)

  // Column template mirrors the candidates blueprint (§3A): identity → phase/status →
  // dates → qualification → Koios → owner LAST (Danny 2026-07-14 table standardization).
  const columns: Column<Application>[] = [
    // Candidate — avatar + name. Sticky first column (stays on horizontal scroll), like the candidates table.
    { key: 'candidate', header: t('cols.candidate'), sortable: true, sortValue: r => r.candidateName,
      sticky: true, width: 200, nowrap: true,
      render: r => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Avatar initials={r.candidateInitials} size={24} soft />
          <span style={{ fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 150 }} title={r.candidateName}>{r.candidateName}</span>
        </span>
      ) },
    // Vacancy — single-line clamp so long titles don't blow up the row.
    { key: 'vacancy', header: t('cols.vacancy'), sortable: true, sortValue: r => r.vacancyTitle,
      render: r => (
        <span style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: 320, color: 'var(--text)' }}>
          {r.vacancyTitle}
        </span>
      ) },
    // Klant — soft avatar + name (AVATAR-CHIP-1: same chip as the candidate identity
    // column), muted text keeps it reading as a secondary reference.
    { key: 'client', header: t('cols.client'), sortable: true, nowrap: true,
      render: r => <EntityNameCell name={r.client} textStyle={{ color: 'var(--text-muted)' }} /> },
    // Match score.
    { key: 'score', header: t('cols.score'), align: 'right', sortable: true,
      sortValue: r => r.score ?? -1, render: r => <ScorePill value={r.score} plain={!colorScore} /> },
    // Funnel phase — soft pill in the phase colour (or plain text when the toggle is off).
    { key: 'phase', header: t('cols.phase'), sortable: true, sortValue: r => r.phaseLabel ?? '',
      render: r => colorPhase
        ? <StatusPill label={r.phaseLabel} color={r.phaseColor} />
        : <span style={plainCell}>{r.phaseLabel || '—'}</span> },
    // Candidate deployability status — the ONE shared chip (C-CHIP): slug drives the
    // model-v2 rules (Lead→dash, blacklist), with the pre-resolved label/colour as
    // fallback until the /applications resource exposes the slug (BE gap filed).
    { key: 'status', header: t('cols.status'), sortable: true, sortValue: r => r.candidateStatusLabel,
      render: r => <CandidateStatusChip status={r.candidateStatus} phase={r.candidatePhase}
        fallbackLabel={r.candidateStatusLabel} fallbackColor={r.candidateStatusColor} plain={!colorStatus} round /> },
    // Created date — the table defaults to newest first.
    { key: 'created', header: t('cols.created'), nowrap: true, sortable: true, sortValue: r => r.created ?? '',
      cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, render: r => r.created ? formatDate(r.created) : '—' },
    { key: 'source', header: t('cols.source'), sortable: true, cellStyle: { color: 'var(--text-muted)', fontSize: 12 } },
    // AI task — Koios mark + clamped text.
    { key: 'task', header: t('cols.task'),
      render: r => r.task ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: 220 }}>
          <KoiosAiMark size={16} />
          <span style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 12, color: 'var(--text-muted)' }}>
            {r.task}
          </span>
        </span>
      ) : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    // Owner — avatar + name. LAST column (§3A convention).
    { key: 'owner', header: t('cols.owner'), sortable: true, sortValue: r => r.owner?.name,
      render: r => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Avatar initials={r.owner?.initials} size={22} color={colorOwner ? r.owner?.color : 'var(--text-muted)'} soft />
          <span style={{ fontSize: 12, color: 'var(--text)' }}>{r.owner?.name}</span>
        </span>
      ) },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      loading={loading}
      loadingText={t('loading')}
      emptyText={error ? t('error') : t('empty')}
      onRowClick={onSelect}
      selectedId={selectedId}
      stickyHeader={stickyHeader}
      defaultSort={{ key: 'created', dir: 'desc' }}
      selectable={selectable}
      selectedIds={selectedIds}
      onToggleRow={onToggleRow}
      onToggleAll={onToggleAll}
      scrollParentRef={scrollParentRef}
    />
  )
}
