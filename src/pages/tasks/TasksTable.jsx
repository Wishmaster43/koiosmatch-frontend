import { useTranslation } from 'react-i18next'
import DataTable from '../../components/ui/DataTable'
import StatusPill from '../../components/ui/StatusPill'

// TasksTable — declares columns only; the shared DataTable owns sorting + states.
export default function TasksTable({ rows, loading, error }) {
  const { t } = useTranslation('tasks')

  const columns = [
    { key: 'title',    header: t('cols.task'), sortable: true,
      render: r => <span style={{ fontWeight: 500, color: 'var(--text)' }}>{r.title}</span> },
    { key: 'candidate', header: t('cols.candidate'), sortable: true },
    { key: 'type',      header: t('cols.type'), cellStyle: { color: 'var(--text-muted)' } },
    { key: 'status',    header: t('cols.status'),
      render: r => r.status ? <StatusPill label={r.status} color={r.statusColor} /> : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    { key: 'assignee',  header: t('cols.assignee'), sortable: true, cellStyle: { color: 'var(--text-muted)' } },
    { key: 'due',       header: t('cols.due'), sortable: true, cellStyle: { color: 'var(--text-muted)', fontSize: 12 } },
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
