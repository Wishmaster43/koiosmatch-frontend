import { useTranslation } from 'react-i18next'
import DataTable from '../../components/ui/DataTable'
import type { Column } from '../../components/ui/DataTable'
import Avatar from '../../components/ui/Avatar'
import StatusPill from '../../components/ui/StatusPill'
import KoiosAiMark from '../../components/ui/KoiosAiMark'
import type { Application } from '../../types/application'
import type { Id } from '../../types/common'

// Match score as a soft-coloured percentage (green ≥75, amber ≥50, red below).
function ScorePill({ value }: { value: number | null }) {
  if (value == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const c = value >= 75 ? 'var(--color-success)' : value >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'
  return <span style={{ fontWeight: 600, color: c }}>{value}%</span>
}

interface ApplicationsTableProps {
  rows: Application[]
  loading?: boolean
  error?: unknown
  selectedId?: Id | null
  onSelect?: (row: Application) => void
  stickyHeader?: boolean
}

/**
 * ApplicationsTable — declares columns only; the shared DataTable owns sorting,
 * selection, hover and the loading/empty states. Mirrors MatchesTable.
 */
export default function ApplicationsTable({ rows, loading, error, selectedId, onSelect, stickyHeader = false }: ApplicationsTableProps) {
  const { t } = useTranslation('applications')

  const columns: Column<Application>[] = [
    // Candidate — avatar + name.
    { key: 'candidate', header: t('cols.candidate'), sortable: true, sortValue: r => r.candidateName,
      render: r => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar initials={r.candidateInitials} size={24} />
          <span style={{ fontWeight: 500, color: 'var(--text)' }}>{r.candidateName}</span>
        </span>
      ) },
    // Vacancy — single-line clamp so long titles don't blow up the row.
    { key: 'vacancy', header: t('cols.vacancy'), sortable: true, sortValue: r => r.vacancyTitle,
      render: r => (
        <span style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: 320, color: 'var(--text)' }}>
          {r.vacancyTitle}
        </span>
      ) },
    // Match score.
    { key: 'score', header: t('cols.score'), align: 'right', sortable: true,
      sortValue: r => r.score ?? -1, render: r => <ScorePill value={r.score} /> },
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
    // Funnel phase — soft pill in the phase colour.
    { key: 'phase', header: t('cols.phase'), sortable: true, sortValue: r => r.phaseLabel ?? '',
      render: r => <StatusPill label={r.phaseLabel} color={r.phaseColor} /> },
    { key: 'source', header: t('cols.source'), sortable: true, cellStyle: { color: 'var(--text-muted)', fontSize: 12 } },
    // Owner — avatar + name.
    { key: 'owner', header: t('cols.owner'), sortable: true, sortValue: r => r.owner?.name,
      render: r => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Avatar initials={r.owner?.initials} size={22} color={r.owner?.color} />
          <span style={{ fontSize: 12, color: 'var(--text)' }}>{r.owner?.name}</span>
        </span>
      ) },
    { key: 'client', header: t('cols.client'), sortable: true, cellStyle: { color: 'var(--text-muted)', fontSize: 12 } },
    // Candidate lifecycle status — soft pill.
    { key: 'status', header: t('cols.status'), sortable: true, sortValue: r => r.candidateStatusLabel,
      render: r => r.candidateStatusLabel
        ? <StatusPill label={r.candidateStatusLabel} color={r.candidateStatusColor} />
        : <span style={{ color: 'var(--text-muted)' }}>—</span> },
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
    />
  )
}
