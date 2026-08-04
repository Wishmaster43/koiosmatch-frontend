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
import CalloutBox from '@/components/ui/CalloutBox'

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

  // Load once per mount — alive-guard (CLAUDE.md §9) drops a response that
  // resolves after unmount. `t` is deliberately NOT a dependency: i18next's `t`
  // always reads the CURRENT language when called, so the catch's translated
  // message stays correct even from this mount-time closure; keeping `t` in the
  // deps re-ran this fetch on every language switch and raced two responses,
  // with no guard to stop the older one from overwriting the newer.
  useEffect(() => {
    let alive = true
    api.get('/activity-log')
      .then(res => { if (alive) setLogs(unwrapList(res).rows) })
      .catch(() => { if (alive) setError(t('audit.unavailable')) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above: `t` excluded on purpose
  }, [])

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
        <div style={{ marginBottom: 12 }}>
          <CalloutBox variant="warning">{error}</CalloutBox>
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
