import { useTranslation } from 'react-i18next'
import DataTable from '../../components/ui/DataTable'
import Avatar from '../../components/ui/Avatar'
import StatusPill from '../../components/ui/StatusPill'

// Match score as a soft-coloured percentage (green ≥75, amber ≥50, red below).
function ScorePill({ value }) {
  if (value == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const c = value >= 75 ? 'var(--color-success)' : value >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'
  return <span style={{ fontWeight: 600, color: c }}>{value}%</span>
}

// MatchesTable — declares columns only; the shared DataTable owns sorting + states.
export default function MatchesTable({ rows, loading, error }) {
  const { t } = useTranslation('matches')

  const columns = [
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
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{t('title')}</h2>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <DataTable columns={columns} rows={rows} loading={loading}
          loadingText={t('loading')} emptyText={error ? t('error') : t('empty')} />
      </div>
    </>
  )
}
