/**
 * AuditLog — tenant audit log screen: loads the activity log, sorts and paginates it,
 * and composes the toolbar, the table and the drill-down drawer. Filtering lives in
 * useAuditFilters (right panel), the table markup in AuditLogTable, the CSV in
 * auditCsvExport — this file only wires them together.
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import { AuditDrawer } from './AuditDrawer'
import AuditLogTable from './AuditLogTable'
import { useAuditFilters } from './useAuditFilters'
import { exportAuditCsv } from './auditCsvExport'
import PaginationBar from '@/components/ui/PaginationBar'

const PAGE_SIZE = 25

export default function AuditLog() {
  const { t } = useTranslation('settings')
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [drill,   setDrill]   = useState(null)
  const [sortCol, setSortCol] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [page,    setPage]    = useState(1)

  useEffect(() => {
    api.get('/activity-log')
      .then(res => setLogs(unwrapList(res).rows))
      .catch(() => setError(t('audit.unavailable')))
      .finally(() => setLoading(false))
  }, [t])

  // All filter axes + the right-panel registration live in the hook; it hands back the
  // surviving rows and a key that changes whenever a filter value does.
  const { filteredAll, filterKey } = useAuditFilters(logs)

  // Sort the filtered list.
  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filteredAll].sort((a, b) => {
      if (sortCol === 'created_at') return dir * (new Date(a.created_at) - new Date(b.created_at))
      if (sortCol === 'causer_name') return dir * (a.causer_name ?? '').localeCompare(b.causer_name ?? '')
      if (sortCol === 'log_name')    return dir * (a.log_name    ?? '').localeCompare(b.log_name    ?? '')
      if (sortCol === 'description') return dir * (a.description ?? '').localeCompare(b.description ?? '')
      return 0
    })
  }, [filteredAll, sortCol, sortDir])

  // Reset page when filters change.
  useEffect(() => { setPage(1) }, [filterKey])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageRows   = useMemo(() => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [sorted, page])

  // Toggle sort column — same column flips direction, new column defaults to desc.
  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Toolbar: count summary + export — search/date/filters are in the right filter panel */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 12, flexShrink: 0 }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {loading ? t('audit.loading') : t('audit.countSummary', { shown: filteredAll.length, total: logs.length })}
        </p>
        <button onClick={() => exportAuditCsv(filteredAll, t)} disabled={filteredAll.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', fontSize: 12,
                   fontWeight: 500, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)',
                   color: 'var(--text)', cursor: filteredAll.length ? 'pointer' : 'not-allowed',
                   opacity: filteredAll.length ? 1 : 0.5, whiteSpace: 'nowrap' }}>
          <Download size={13} /> {t('audit.export')}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--color-warning-bg)',
                      // eslint-disable-next-line no-restricted-syntax -- no exact/close index.css token match for this warning-banner border/text shade; kept literal to avoid changing the rendered tone
                      border: '1px solid #FDE68A', fontSize: 13, color: '#92400E', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <AuditLogTable rows={pageRows} sortCol={sortCol} sortDir={sortDir}
          onSort={handleSort} onRowClick={setDrill} />
      )}

      {/* Pagination bar replaces the old load-more button. */}
      {!loading && !error && sorted.length > 0 && (
        <PaginationBar page={page} totalPages={totalPages} totalRows={sorted.length}
          pageSize={PAGE_SIZE} onPageChange={setPage}
          onPageSizeChange={null} />
      )}

      {drill && <AuditDrawer entry={drill} onClose={() => setDrill(null)} />}
    </div>
  )
}
