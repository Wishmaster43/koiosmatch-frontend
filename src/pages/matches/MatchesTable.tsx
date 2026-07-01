import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import Avatar from '@/components/ui/Avatar'
import StatusPill from '@/components/ui/StatusPill'
import ScorePill from './ScorePill'
import type { MatchRow } from '@/types/match'

interface MatchesTableProps {
  rows: MatchRow[]
  loading?: boolean
  error?: boolean
  stickyHeader?: boolean
  scrollParentRef?: RefObject<HTMLElement | null>
  // Row click opens the read-only detail drawer (§3A drill-down).
  onRowClick?: (row: MatchRow) => void
}

// MatchesTable — declares columns only; the shared DataTable owns sorting + states.
export default function MatchesTable({ rows, loading, error, stickyHeader = false, scrollParentRef, onRowClick }: MatchesTableProps) {
  const { t } = useTranslation('matches')

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
    { key: 'stage',   header: t('cols.stage'),
      render: r => r.stage ? <StatusPill label={r.stage} color={r.stageColor} /> : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    { key: 'owner',   header: t('cols.owner'), sortable: true, cellStyle: { color: 'var(--text-muted)' } },
    { key: 'date',    header: t('cols.date'),  sortable: true, cellStyle: { color: 'var(--text-muted)', fontSize: 12 } },
  ]

  return (
    <>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <DataTable columns={columns} rows={rows} loading={loading}
          loadingText={t('loading')} emptyText={error ? t('error') : t('empty')}
          stickyHeader={stickyHeader} scrollParentRef={scrollParentRef} onRowClick={onRowClick} />
      </div>
    </>
  )
}
