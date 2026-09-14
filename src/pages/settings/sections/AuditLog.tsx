/**
 * AuditLog — tenant audit log screen: loads the activity log, sorts and paginates it,
 * and composes the toolbar, the table and the drill-down drawer. Filtering lives in
 * useAuditFilters (right panel), the table markup in AuditLogTable, the CSV in
 * auditCsvExport — this file only wires them together.
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { useAllSettings, getNumberSetting } from '@/lib/settings/useAllSettings'
import { AuditDrawer } from './AuditDrawer'
import AuditLogTable from './AuditLogTable'
import { useAuditFilters } from './useAuditFilters'
import { exportAuditCsv } from './auditCsvExport'
import PaginationBar from '@/components/ui/PaginationBar'
import CalloutBox from '@/components/ui/CalloutBox'
import LogCountToolbar from '@/components/ui/LogCountToolbar'
import type { AuditEntry } from './auditShared'

// Client-side page size — the backend per_page limit is passed from tenant settings (activity_log_limit).
const PAGE_SIZE = 25

// The sortable column keys this screen supports.
type SortCol = 'created_at' | 'causer_name' | 'log_name' | 'description'

// Thin container wiring the toolbar, table and drill-down drawer together (see
// file docblock above); filtering and table markup live in their own modules.
export default function AuditLog() {
  const { t } = useTranslation('settings')
  const settings = useAllSettings()
  const [logs,    setLogs]    = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [drill,   setDrill]   = useState<AuditEntry | null>(null)
  const [sortCol, setSortCol] = useState<SortCol>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page,    setPage]    = useState(1)

  // Load once per mount — alive-guard (CLAUDE.md §9) drops a response that
  // resolves after unmount. `t` is deliberately NOT a dependency: i18next's `t`
  // always reads the CURRENT language when called, so the catch's translated
  // message stays correct even from this mount-time closure; keeping `t` in the
  // deps re-ran this fetch on every language switch and raced two responses,
  // with no guard to stop the older one from overwriting the newer. The per_page
  // limit comes from tenant settings (activity_log_limit, default 200).
  useEffect(() => {
    let alive = true
    const limit = getNumberSetting(settings, 'activity_log_limit', 200)
    api.get('/activity-log', { params: { per_page: limit } })
      .then(res => { if (alive) setLogs(unwrapList<AuditEntry>(res).rows) })
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
    return [...filteredAll].sort((a: AuditEntry, b: AuditEntry) => {
      if (sortCol === 'created_at') return dir * (new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
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
  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Toolbar: count summary + export — search/date/filters are in the right filter panel */}
      <LogCountToolbar loading={loading} shown={filteredAll.length} total={logs.length}
        onExport={() => exportAuditCsv(filteredAll, t)} exportDisabled={filteredAll.length === 0} />

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
          pageSize={PAGE_SIZE} onPageChange={setPage} />
      )}

      {drill && <AuditDrawer entry={drill} onClose={() => setDrill(null)} />}
    </div>
  )
}
