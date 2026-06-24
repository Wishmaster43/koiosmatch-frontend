import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { useRightPanel } from '../../context/RightPanelContext'
import { useAuth } from '../../context/AuthContext'
import api, { unwrapList } from '../../lib/api'
import { useUsers } from '../../lib/queries'
import { USE_MOCKS, isAbortError } from '../../lib/mocks'
import { VacancyLookupsProvider, useVacancyLookups } from '../../context/VacancyLookupsContext'
import InsightsRow from '../../components/insights/InsightsRow'
import PaginationBar from '../../components/ui/PaginationBar'
import VacanciesTable from './VacanciesTable'
import VacanciesBulkBar from './VacanciesBulkBar'
import VacancyDrawer from './VacancyDrawer'
import AddVacancyModal from './AddVacancyModal'
import { mapVacancy, mapVacancyDetail } from './data/mapVacancy'

// Set exactly one value in a multi-select, or clear when it's already the only one.
const toggleOneValue = (set, value) =>
  set(p => (p.length === 1 && p[0] === value) ? [] : [value])

// Two-letter initials from a name, e.g. "Bente de Jong" → "BJ".
const initialsOf = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'

// Recharts hands the clicked segment back at top level AND under `.payload`.
const pickKey = (d) => d?.key ?? d?.payload?.key ?? d?.name

function VacanciesPageInner() {
  const { t } = useTranslation('vacancies')
  const { registerFilters, unregisterFilters } = useRightPanel()
  const { hasPermission, user } = useAuth()
  const { statuses, phases, statusMeta } = useVacancyLookups()
  const { data: users = [] } = useUsers()

  const [vacancies, setVacancies] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [page,      setPage]      = useState(1)
  // TODO C-33: use user.default_per_page once the backend accepts per_page > 100 on this endpoint.
  const [pageSize,  setPageSize]  = useState(50)
  const [lastPage,  setLastPage]  = useState(1)
  const [total,     setTotal]     = useState(0)
  const [stats,     setStats]     = useState(null)
  const [customers, setCustomers] = useState([])

  const [selected,       setSelected]       = useState(null)
  const [detail,         setDetail]         = useState(null)
  const [drawerExpanded, setDrawerExpanded] = useState(false)
  const [addOpen,        setAddOpen]        = useState(false)
  const [selectedIds,    setSelectedIds]    = useState(() => new Set())
  const [actionMsg,      setActionMsg]      = useState(null)
  const msgTimer = useRef(null)

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

  // Load the customers once for the filters/drawer/modal/bulk pickers.
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/customers', { signal: ctrl.signal })
      .then(res => setCustomers(unwrapList(res).rows.map(c => ({ id: c.id, name: c.name ?? c.company_name ?? '—' }))))
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  // ── List (paginated, server-filtered) ──
  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true); setError(null)
    api.get('/vacancies', { params: { ...filterParams, page, per_page: pageSize }, signal: ctrl.signal })
      .then(res => {
        const { rows, total, lastPage } = unwrapList(res)
        setVacancies(rows.map(mapVacancy)); setTotal(total); setLastPage(lastPage)
      })
      .catch(err => {
        if (isAbortError(err)) return
        // A 404 means the endpoint isn't built yet (C-26) → empty, not an error.
        if (err?.response?.status && err.response.status !== 404 && !USE_MOCKS) {
          setError(t('page.loadError'))
        }
        setVacancies([]); setTotal(0); setLastPage(1)
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [filterParams, page, pageSize, t])

  // ── Stats (server-wide totals; honour the filters) ──
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/vacancies/stats', { params: filterParams, signal: ctrl.signal })
      .then(res => setStats(res.data?.data ?? res.data ?? null))
      .catch(err => { if (!isAbortError(err)) setStats(null) })
    return () => ctrl.abort()
  }, [filterParams])

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

  // ── KPI cards = funnel-phase counts across applications (the screenshot KPIs) ──
  const phaseCounts = useMemo(() => {
    if (stats?.by_phase) {
      if (Array.isArray(stats.by_phase)) return Object.fromEntries(stats.by_phase.map(o => [o.value ?? o.phase, o.count]))
      return stats.by_phase
    }
    // Fallback: sum the per-vacancy phase breakdown on the loaded page.
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
  const selectedIdRef = useRef(null)
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

    const body = {}
    if ('statusValue'        in patch) body.status              = patch.statusValue
    if ('ownerId'            in patch) body.owner_id            = patch.ownerId
    if ('clientId'           in patch) body.customer_id         = patch.clientId
    if ('tags'               in patch) body.tags                = patch.tags
    if ('channels'           in patch) body.published_channels  = patch.channels
    if ('applicationSettings' in patch) body.application_settings = patch.applicationSettings
    if ('matchWeights'        in patch) body.match_weights        = patch.matchWeights
    if (Object.keys(body).length) api.patch(`/vacancies/${id}`, body).catch(() => {})
  }

  // ── Bulk selection ──
  const toggleRow = (id) => setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  const toggleAll = (ids, allSelected) => setSelectedIds(prev => { const next = new Set(prev); ids.forEach(id => allSelected ? next.delete(id) : next.add(id)); return next })

  const notify = (type, text) => {
    setActionMsg({ type, text })
    if (msgTimer.current) clearTimeout(msgTimer.current)
    msgTimer.current = setTimeout(() => setActionMsg(null), 4000)
  }
  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current) }, [])

  // Snapshot a subset of fields, for optimistic revert/reconcile.
  const subsetOf = (obj, keys) => keys.reduce((a, k) => { a[k] = obj[k]; return a }, {})

  // Generic optimistic bulk mutation: apply `patch`, persist, reconcile on the
  // server's `updated` list, revert on failure. Mirrors the candidate bulkMutate.
  const bulkMutate = ({ url, body, patch, keys, onSuccess }) => {
    const ids = [...selectedIds]
    if (!ids.length) return
    const snap = new Map(vacancies.filter(v => ids.includes(v.id)).map(v => [v.id, subsetOf(v, keys)]))
    setVacancies(prev => prev.map(v => ids.includes(v.id) ? { ...v, ...patch } : v))
    api.post(url, { vacancy_ids: ids, ...body })
      .then((res) => {
        const updated = Array.isArray(res.data?.updated) ? new Set(res.data.updated) : null
        if (updated) setVacancies(prev => prev.map(v => (ids.includes(v.id) && !updated.has(v.id)) ? { ...v, ...snap.get(v.id) } : v))
        onSuccess(updated ? updated.size : ids.length)
      })
      .catch(() => {
        setVacancies(prev => prev.map(v => ids.includes(v.id) ? { ...v, ...snap.get(v.id) } : v))
        notify('error', t('bulk.mutateError'))
      })
    setSelectedIds(new Set())
  }
  const bulkSetOwner = (user) => bulkMutate({
    url: '/vacancies/bulk/owner', body: { owner_id: user.id },
    patch: { owner: { id: user.id, name: user.name, initials: initialsOf(user.name), color: null } }, keys: ['owner'],
    onSuccess: (n) => notify('success', t('bulk.ownerChanged', { count: n })),
  })
  const bulkSetStatus = (statusValue) => { const m = statusMeta(statusValue); bulkMutate({
    url: '/vacancies/bulk/status', body: { status: statusValue },
    patch: { statusValue, statusLabel: m.label, statusColor: m.color }, keys: ['statusValue', 'statusLabel', 'statusColor'],
    onSuccess: (n) => notify('success', t('bulk.statusChanged', { value: m.label, count: n })),
  }) }
  const bulkSetClient = (customer) => bulkMutate({
    url: '/vacancies/bulk/client', body: { customer_id: customer.id },
    patch: { clientId: customer.id, clientName: customer.name }, keys: ['clientId', 'clientName'],
    onSuccess: (n) => notify('success', t('bulk.clientChanged', { count: n })),
  })
  const bulkPublish = (published) => bulkMutate({
    url: '/vacancies/bulk/publish', body: { published },
    patch: { published }, keys: ['published'],
    onSuccess: (n) => notify('success', t(published ? 'bulk.published' : 'bulk.unpublished', { count: n })),
  })

  // Remove a tag from every selected vacancy that has it (optimistic + reconcile).
  const bulkRemoveTag = (tag) => {
    const ids = [...selectedIds]
    if (!ids.length || !tag) return
    const changed = vacancies.filter(v => ids.includes(v.id) && (v.tags ?? []).includes(tag)).map(v => v.id)
    setVacancies(prev => prev.map(v => changed.includes(v.id) ? { ...v, tags: (v.tags ?? []).filter(x => x !== tag) } : v))
    api.post('/vacancies/bulk/tags/remove', { vacancy_ids: ids, tag })
      .then((res) => {
        const updated = Array.isArray(res.data?.updated) ? new Set(res.data.updated) : null
        if (updated) setVacancies(prev => prev.map(v => (changed.includes(v.id) && !updated.has(v.id)) ? { ...v, tags: [...(v.tags ?? []), tag] } : v))
        notify('success', t('bulk.tagRemoved', { tag, count: updated ? updated.size : changed.length }))
      })
      .catch(() => {
        setVacancies(prev => prev.map(v => changed.includes(v.id) ? { ...v, tags: [...(v.tags ?? []), tag] } : v))
        notify('error', t('bulk.mutateError'))
      })
    setSelectedIds(new Set())
  }
  // Add the same note to every selected vacancy (no table column → toast only).
  const bulkAddNote = (text) => {
    const ids = [...selectedIds]
    if (!ids.length || !text.trim()) return
    api.post('/vacancies/bulk/notes', { vacancy_ids: ids, text: text.trim() })
      .then((res) => notify('success', t('bulk.noteAdded', { count: Array.isArray(res.data?.updated) ? res.data.updated.length : ids.length })))
      .catch(() => notify('error', t('bulk.mutateError')))
    setSelectedIds(new Set())
  }
  // Archive (soft-delete) the selection — confirm first; rows drop on server confirm.
  const bulkArchive = () => {
    const ids = [...selectedIds]
    if (!ids.length) return
    if (!window.confirm(t('bulk.archiveConfirm', { count: ids.length }))) return
    api.post('/vacancies/bulk/archive', { vacancy_ids: ids })
      .then((res) => {
        const archived = Array.isArray(res.data?.archived) ? res.data.archived : ids
        const set = new Set(archived)
        setVacancies(prev => prev.filter(v => !set.has(v.id)))
        setTotal(tt => Math.max(0, tt - archived.length))
        notify('success', t('bulk.archived', { count: archived.length }))
      })
      .catch(() => notify('error', t('bulk.archiveError')))
    setSelectedIds(new Set())
  }

  // Union of tags across the selected vacancies — the "remove tag" option list.
  const selectedTags = useMemo(() => {
    const set = new Set()
    vacancies.forEach(v => { if (selectedIds.has(v.id)) (v.tags ?? []).forEach(tg => set.add(tg)) })
    return [...set]
  }, [vacancies, selectedIds])

  // ── Insights strip: 3 donuts + funnel-phase KPI cards (the requested KPI block) ──
  // Status donut click toggles the status tab; owner/client click set a single filter.
  const insightDonuts = [
    { key: 'status', title: t('insights.statusTitle'), data: statusData,
      onPick: d => { const k = pickKey(d); setStatusBucket(prev => (prev === k ? 'all' : (k ?? 'all'))) },
      active: statusBucket !== 'all', onClear: () => setStatusBucket('all') },
    { key: 'owner',  title: t('insights.ownerTitle'),  data: ownerData,  onPick: d => pickOne(setSelectedOwner)(pickKey(d)),  active: selectedOwner.length > 0,  onClear: () => setSelectedOwner([]) },
    { key: 'client', title: t('insights.clientTitle'), data: clientData, onPick: d => pickOne(setSelectedClient)(pickKey(d)), active: selectedClient.length > 0, onClear: () => setSelectedClient([]) },
  ]
  // KPI cards = funnel-phase counts, lookup-driven (label via i18n, colour from the lookup).
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

          {/* KPI block: donuts + funnel-phase KPI cards (same row as candidates) */}
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
