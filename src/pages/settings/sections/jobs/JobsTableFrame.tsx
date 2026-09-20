import { useTranslation } from 'react-i18next'
import DataTable from '@/components/ui/DataTable'
import type { Column, RowId } from '@/components/ui/DataTable'

interface JobsTableFrameProps<Row> {
  phase: 'loading' | 'error' | 'ready'
  columns: Column<Row>[]
  rows: Row[]
  emptyText: string
  getRowId: (row: Row) => RowId
}
/**
 * Shared table frame for both JobsTab and FailedJobsTab — error state + bordered div + DataTable.
 * Props: phase ('loading'|'error'|'ready'), columns, rows, emptyText, getRowId.
 */
export default function JobsTableFrame<Row>({ phase, columns, rows, emptyText, getRowId }: JobsTableFrameProps<Row>) {
  const { t } = useTranslation('settings')

  if (phase === 'error') {
    return <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>{t('jobs.loadError')}</p>
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto' }}>
      <DataTable columns={columns} rows={rows} loading={phase === 'loading'} emptyText={emptyText} getRowId={getRowId} />
    </div>
  )
}
