/**
 * VacanciesPage — the vacancy list surface (mirrors the candidate blueprint).
 * Thin container: owns UI state (filters, selection, drawer), composes the data
 * hook (customers/list/stats) and the bulk-actions hook, derives the donut data
 * + filters, and renders the insights row + status tabs + table + drawer. Page-
 * scoped VacancyLookupsProvider so the table/drawer/modal/bulk share one fetch.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { useRightPanel } from '../../context/RightPanelContext'
import { useAuth } from '../../context/AuthContext'
import { useUsers } from '../../lib/queries'
import api from '../../lib/api'
import { VacancyLookupsProvider, useVacancyLookups } from '../../context/VacancyLookupsContext'
import InsightsRow from '../../components/insights/InsightsRow'
import PaginationBar from '../../components/ui/PaginationBar'
import VacanciesTable from './VacanciesTable'
import VacanciesBulkBar from './VacanciesBulkBar'
import VacancyDrawer from './VacancyDrawer'
import AddVacancyModal from './AddVacancyModal'
import { mapVacancyDetail } from './data/mapVacancy'
import { toggleOneValue, initialsOf, pickKey, buildVacancyPatch } from './data/vacanciesShared'
import { useVacanciesData } from './hooks/useVacanciesData'
import { useVacancyBulkActions } from './hooks/useVacancyBulkActions'

function VacanciesPageInner() {
  const { t } = useTranslation('vacancies')
  const { registerFilters, unregisterFilters } = useRightPanel()
  const { hasPermission } = useAuth()
  const { statuses, phases, statusMeta } = useVacancyLookups()
  const { data: users = [] } = useUsers()

  const [page,      setPage]      = useState(1)
  const [pageSize,  setPageSize]  = useState(50)
  const [selected,       setSelected]       = useState(null)
  const [detail,         setDetail]         = useState(null)
  const [drawerExpanded, setDrawerExpanded] = useState(false)
  const [addOpen,        setAddOpen]        = useState(false)
  const [selectedIds,    setSelectedIds]    = useState(() => new Set())
  const [actionMsg,      setActionMsg]      = useState(null)
  const msgTimer = useRef(null)
  const selectedIdRef = useRef(null)

  // Server-side filter dimensions. Status is driven by the tab bar (single value).
  const [statusBucket,   setStatusBucket]   = useState('all')
  const [selectedOwner,  setSelectedOwner]  = useState([])
  const [selectedClient, setSelectedClient] = useState([])
  const [globalSearch,   setGlobalSearch]   = useState('')

  const handlePageSizeChange = (newSize) => { setPageSize(newSize); setPage(1) }

  // Server-side filter params (axios serialises arrays as `key[]`).
  const filterParams = useMemo(() => {
    const p = {}
    if (globalSearch.trim())    p.search      = globalSearch.trim()
    if (statusBucket !== 'all') p.status      = [statusBucket]
    if (selectedOwner.length)   p.owner_id    = selectedOwner
    if (selectedClient.length)  p.customer_id = selectedClient
    return p
  }, [globalSearch, statusBucket, selectedOwner, selectedClient])
  const filterKey = JSON.stringify(filterParams)

  // Filters changed → back to page 1; the visible rows change → drop the selection.
  useEffect(() => { setPage(1) }, [filterKey])
  useEffect(() => { setSelectedIds(new Set()) }, [filterKey, page, pageSize])

  const notify = (type, text) => {
    setActionMsg({ type, text })
    if (msgTimer.current) clearTimeout(msgTimer.current)
    msgTimer.current = setTimeout(() => setActionMsg(null), 4000)
  }
  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current) }, [])

  // ── Data layer ──
  const { vacancies, setVacancies, loading, error, total, setTotal, lastPage, stats, customers } =
    useVacanciesData({ filterParams, page, pageSize, t })

  // ── Donut data (status / owner / client) — stats first, page-derived fallback ──
  const statusData = useMemo(() => {
    if (stats?.by_status) return stats.by_status.map(o => { const v = o.value ?? o.status; const m = statusMeta(v); return { name: m.label, value: o.count, key: v, color: m.color } })
    return statuses.map(s => ({ name: s.label, key: s.value, color: s.color, value: vacancies.filter(v => v.statusValue === s.value).length })).filter(d => d.value > 0)
  }, [stats, statuses, vacancies, statusMeta])
  const ownerData = useMemo(() => {
    if (stats?.by_owner) return stats.by_owner.map(o => ({ name: o.name || '—', key: o.id ?? o.owner_id, value: o.count })).filter(o => o.key)
    const m = {}
    vacancies.forEach(v => { if (v.owner?.id) (m[v.owner.id] ??= { name: v.owner.name || '—', key: v.owner.id, color: v.owner.color, value: 0 }).value++ })
    return Object.values(m)
  }, [stats, vacancies])
  const clientData = useMemo(() => {
    if (stats?.by_client) return stats.by_client.map(o => ({ name: o.name || '—', key: o.id ?? o.customer_id, value: o.count })).filter(o => o.key)
    const m = {}
    vacancies.forEach(v => { if (v.clientId) (m[v.clientId] ??= { name: v.clientName || '—', key: v.clientId, value: 0 }).value++ })
    return Object.values(m)
  }, [stats, vacancies])

  // KPI cards = funnel-phase counts across applications.
  const phaseCounts = useMemo(() => {
    if (stats?.by_phase) {
      if (Array.isArray(stats.by_phase)) return Object.fromEntries(stats.by_phase.map(o => [o.value ?? o.phase, o.count]))
      return stats.by_phase
    }
    const acc = {}
    vacancies.forEach(v => Object.entries(v.applicationsByPhase ?? {}).forEach(([k, n]) => { acc[k] = (acc[k] ?? 0) + (Number(n) || 0) }))
    return acc
  }, [stats, vacancies])

  // Option lists for the right-panel filters.
  const ownerOptions  = useMemo(() => ownerData.map(d => ({ value: d.key, label: d.name, count: d.value })), [ownerData])
  const clientOptions = useMemo(() => clientData.map(d => ({ value: d.key, label: d.name, count: d.value })), [clientData])

  const tog = (set) => (v) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])
  const pickOne = (set) => (v) => { if (v != null) toggleOneValue(set, v) }

  // Register the right-panel filters (owner + client; status is the tab bar).
  const catOrg = t('filters.categories.organisation')
  const filterGroups = useMemo(() => [
    { key: 'global-search', type: 'global-search', label: t('filters.search'), placeholder: t('page.searchPlaceholder'), value: globalSearch, onChange: setGlobalSearch },
    { key: 'owner',  type: 'search-select', category: catOrg, label: t('filters.owner'),  selected: selectedOwner,  options: ownerOptions,  onToggle: tog(setSelectedOwner) },
    { key: 'client', type: 'search-select', category: catOrg, label: t('filters.client'), selected: selectedClient, options: clientOptions, onToggle: tog(setSelectedClient) },
  ], [t, catOrg, globalSearch, selectedOwner, selectedClient, ownerOptions, clientOptions])

  useEffect(() => {
    registerFilters('vacancies-page', filterGroups)
    return () => unregisterFilters('vacancies-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // ── Drawer: light row first, then fetch the full detail (ref-guarded) ──
  const selectVacancy = (v) => {
    if (selected?.id === v.id) { closeDrawer(); return }
    selectedIdRef.current = v.id
    setSelected(v); setDetail(null); setDrawerExpanded(false)
    api.get(`/vacancies/${v.id}`)
      .then(r => { if (selectedIdRef.current === v.id) setDetail(mapVacancyDetail(r.data?.data ?? r.data)) })
      .catch(() => {})
  }
  const closeDrawer = () => { selectedIdRef.current = null; setSelected(null); setDetail(null); setDrawerExpanded(false) }

  // A freshly created vacancy: prepend + open its drawer (which fetches the detail).
  const handleCreated = (v) => { setVacancies(prev => [v, ...prev]); setTotal(prev => prev + 1); setAddOpen(false); selectVacancy(v) }

  // Header/picker edits flow back here: optimistic locally, then PATCH the API.
  const updateVacancy = (id, patch) => {
    const local = { ...patch }
    if ('statusValue' in patch) { const m = statusMeta(patch.statusValue); local.statusLabel = m.label; local.statusColor = m.color }
    if ('ownerId' in patch) { const u = users.find(x => x.id === patch.ownerId); local.owner = { id: patch.ownerId, name: u?.name ?? '', initials: initialsOf(u?.name ?? ''), color: null } }
    if ('clientId' in patch) { const c = customers.find(x => x.id === patch.clientId); local.clientName = c?.name ?? '' }

    setVacancies(prev => prev.map(x => x.id === id ? { ...x, ...local } : x))
    setSelected(prev => (prev && prev.id === id ? { ...prev, ...local } : prev))
    setDetail(prev   => (prev && prev.id === id ? { ...prev, ...local } : prev))

    const body = buildVacancyPatch(patch)
    if (Object.keys(body).length) api.patch(`/vacancies/${id}`, body).catch(() => {})
  }

  // ── Bulk actions ──
  const { toggleRow, toggleAll, bulkSetOwner, bulkSetStatus, bulkSetClient, bulkPublish, bulkRemoveTag, bulkAddNote, bulkArchive, selectedTags } =
    useVacancyBulkActions({ vacancies, setVacancies, setTotal, selectedIds, setSelectedIds, notify, t, statusMeta })

  // ── Insights strip: 3 donuts + funnel-phase KPI cards ──
  const insightDonuts = [
    { key: 'status', title: t('insights.statusTitle'), data: statusData,
      onPick: d => { const k = pickKey(d); setStatusBucket(prev => (prev === k ? 'all' : (k ?? 'all'))) },
      active: statusBucket !== 'all', onClear: () => setStatusBucket('all') },
    { key: 'owner',  title: t('insights.ownerTitle'),  data: ownerData,  onPick: d => pickOne(setSelectedOwner)(pickKey(d)),  active: selectedOwner.length > 0,  onClear: () => setSelectedOwner([]) },
    { key: 'client', title: t('insights.clientTitle'), data: clientData, onPick: d => pickOne(setSelectedClient)(pickKey(d)), active: selectedClient.length > 0, onClear: () => setSelectedClient([]) },
  ]
  const insightKpis = phases.map(p => ({
    key: p.value, label: t(`kpi.${p.value}`, p.label), value: phaseCounts[p.value] ?? 0, color: p.color,
  }))

  // Status tab bar: "All" + one button per configured status.
  const buckets = [{ value: 'all', label: t('buckets.all') }, ...statuses.map(s => ({ value: s.value, label: s.label }))]

  return (
    <>
      {addOpen && <AddVacancyModal onClose={() => setAddOpen(false)} onCreated={handleCreated} users={users} customers={customers} />}
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* KPI block: donuts + funnel-phase KPI cards */}
          <InsightsRow donuts={insightDonuts} kpis={insightKpis} clearTitle={t('insights.clearFilter')} />

          {/* Status tab bar + add button on the same row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            padding: '0 24px 10px', flexShrink: 0 }}>
            {buckets.map(b => (
              <button key={b.value} onClick={() => setStatusBucket(b.value)}
                style={{ padding: '5px 14px', fontSize: 13, fontWeight: statusBucket === b.value ? 600 : 400, borderRadius: 7, cursor: 'pointer',
                  background: statusBucket === b.value ? 'var(--color-primary)' : 'transparent',
                  color: statusBucket === b.value ? '#fff' : 'var(--text)',
                  border: statusBucket === b.value ? 'none' : '1px solid var(--border)' }}>
                {b.label}
              </button>
            ))}
            <div style={{ marginLeft: 'auto' }}>
              {selectedIds.size > 0 ? (
                <VacanciesBulkBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}
                  onSetOwner={bulkSetOwner} onSetStatus={bulkSetStatus} onSetClient={bulkSetClient}
                  onPublish={() => bulkPublish(true)} onUnpublish={() => bulkPublish(false)}
                  onRemoveTag={bulkRemoveTag} onAddNote={bulkAddNote} onArchive={bulkArchive}
                  canArchive={hasPermission('vacancies.delete')}
                  users={users} statuses={statuses} customers={customers} selectedTags={selectedTags} />
              ) : (
                <button onClick={() => setAddOpen(true)} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 500,
                  background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                  + {t('page.add')}
                </button>
              )}
            </div>
          </div>

          {/* Transient feedback for bulk mutations (aria-live for screen readers) */}
          {actionMsg && (
            <div role="status" aria-live="polite" style={{ margin: '0 24px 10px', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 8, fontSize: 12.5,
              background: actionMsg.type === 'error' ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
              color: actionMsg.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)',
              border: `1px solid ${actionMsg.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)'}` }}>
              {actionMsg.type === 'error' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
              <span style={{ flex: 1 }}>{actionMsg.text}</span>
              <button onClick={() => setActionMsg(null)} aria-label={t('common:close', 'Sluiten')}
                style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}>
                <X size={13} />
              </button>
            </div>
          )}

          {/* Table */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
            {error && (
              <div className="mb-3 rounded-lg px-3 py-2.5 text-sm text-red-600 bg-red-50 border border-red-200">{error}</div>
            )}
            <VacanciesTable
              rows={vacancies}
              loading={loading}
              selectedId={selected?.id}
              onSelect={selectVacancy}
              selectable
              selectedIds={selectedIds}
              onToggleRow={toggleRow}
              onToggleAll={toggleAll}
              stickyHeader
            />
          </div>

          <PaginationBar page={page} totalPages={lastPage} totalRows={total} pageSize={pageSize}
            onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />
        </div>

        {/* Drawer — remounts (key) when the full detail arrives so tabs re-init */}
        <VacancyDrawer
          key={selected ? `${selected.id}-${detail ? 'full' : 'lite'}` : 'none'}
          vacancy={detail ?? selected}
          onClose={closeDrawer}
          expanded={drawerExpanded}
          onToggleExpand={() => setDrawerExpanded(v => !v)}
          onUpdate={updateVacancy}
          users={users}
          customers={customers}
        />
      </div>
    </>
  )
}

// Page-scoped provider so the table/drawer/modal/bulk share one lookups fetch.
export default function VacanciesPage() {
  return (
    <VacancyLookupsProvider>
      <VacanciesPageInner />
    </VacancyLookupsProvider>
  )
}
