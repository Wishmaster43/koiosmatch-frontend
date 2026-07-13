/**
 * VacanciesPage — the vacancy list surface (mirrors the candidate blueprint).
 * Thin container: owns UI state (filters, selection, drawer), composes the data
 * hook (customers/list/stats) and the bulk-actions hook, derives the donut data
 * + filters, and renders the insights row + status tabs + table + drawer. Page-
 * scoped VacancyLookupsProvider so the table/drawer/modal/bulk share one fetch.
 */
import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertTriangle, X, Archive, Map as MapIcon } from 'lucide-react'
import { useRightPanel } from '@/context/RightPanelContext'
import { useAuth } from '@/context/AuthContext'
import { useUsers } from '@/lib/queries'
import { isReferenceQuery } from '@/lib/referenceNumber'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { VacancyLookupsProvider, useVacancyLookups } from '@/context/VacancyLookupsContext'
import InsightsRow from '@/components/insights/InsightsRow'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import PaginationBar from '@/components/ui/PaginationBar'
import HeaderSearch from '@/components/ui/HeaderSearch'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import VacanciesTable from './VacanciesTable'
import VacanciesBulkBar from './VacanciesBulkBar'
import VacancyDrawer from './VacancyDrawer'
import AddVacancyModal from './AddVacancyModal'
import { toggleOneValue, pickKey } from './data/vacanciesShared'
import { useNavigation } from '@/context/NavigationContext'
import { useDrawerUrl } from '@/hooks/useDrawerUrl'
import { usePageMemory } from '@/lib/usePageMemory'
import { useVacanciesData } from './hooks/useVacanciesData'
import { useVacancyRecord } from './hooks/useVacancyRecord'
import { useOpenFromIntent } from '@/context/NavigationContext'
import { useVacancyBulkActions } from './hooks/useVacancyBulkActions'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

// STRAAL-1: Leaflet only loads when the map view opens (§9 — lazy heavy deps).
const VacanciesMapView = lazy(() => import('./VacanciesMapView'))

interface AppUser { id: Id; name: string }
interface Aggregate { name: string; key: string; color?: string; value: number }
interface VacancyStatsShape {
  by_status?: Array<{ value?: string; status?: string; count?: number }>
  by_owner?: Array<{ id?: Id; owner_id?: Id; name?: string; count?: number }>
  by_client?: Array<{ id?: Id; customer_id?: Id; name?: string; count?: number }>
  by_phase?: Array<{ value?: string; phase?: string; count?: number }> | Record<string, number>
}

function VacanciesPageInner({ intent }: { intent?: unknown }) {
  const { t } = useTranslation(['vacancies', 'common'])
  // Cross-page jump for the funnel KPI cards (→ Sollicitaties with the stage filter).
  const { navigate } = useNavigation()
  // Scroll container for row virtualization (F-11): DataTable virtualizes against it.
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const { registerFilters, unregisterFilters } = useRightPanel()
  const auth = useAuth()
  const hasPermission = auth?.hasPermission ?? (() => false)
  const { statuses, phases, statusMeta } = useVacancyLookups()
  // Coerce to a string|number-tolerant signature for the bulk hook + updaters.
  const statusMetaSafe = (v?: string | number | null) => statusMeta(v == null ? null : String(v))
  const { data: users = [] } = useUsers() as { data?: AppUser[] }

  const [page,      setPage]      = usePageMemory('vac.page', 1)
  const [pageSize,  setPageSize]  = useState(50)
  const [addOpen,        setAddOpen]        = useState(false)
  const [selectedIds,    setSelectedIds]    = useState<Set<Id>>(() => new Set())
  const [actionMsg,      setActionMsg]      = useState<{ type: string; text: string } | null>(null)
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Server-side filter dimensions. Status is driven by the tab bar (single value).
  const [statusBucket,   setStatusBucket]   = usePageMemory('vac.status', 'all')
  const [selectedOwner,  setSelectedOwner]  = usePageMemory<string[]>('vac.owner', [])
  const [selectedClient, setSelectedClient] = usePageMemory<string[]>('vac.client', [])
  const [globalSearch,   setGlobalSearch]   = usePageMemory('vac.search', '')
  const [showArchived,   setShowArchived]   = usePageMemory('vac.archived', false)
  // STRAAL-1: map view + radius-search state (server-side ?lat=&lng=&radius=).
  const [view,      setView]      = usePageMemory<'table' | 'map'>('vac.viewMode', 'table')
  const [mapCenter, setMapCenter] = usePageMemory('vac.mapCenter', { lat: 52.09, lng: 5.12 })
  const [mapRadius, setMapRadius] = usePageMemory('vac.mapRadius', 30)

  const handlePageSizeChange = (newSize: number) => { setPageSize(newSize); setPage(1) }

  // Server-side filter params (axios serialises arrays as `key[]`).
  const filterParams = useMemo(() => {
    const p: Record<string, unknown> = {}
    // NUMMER-1: a typed reference number (V-12) does an exact server-side `?ref=`
    // lookup instead of the normal free-text search; the server ignores other filters.
    if (globalSearch.trim()) {
      const q = globalSearch.trim()
      if (isReferenceQuery(q)) p.ref = q
      else p.search = q
    }
    // '__none' = the "Geen status" donut segment → server-side no_status filter (VAC-NOSTATUS-1).
    if (statusBucket === '__none')   p.no_status = 1
    else if (statusBucket !== 'all') p.status    = [statusBucket]
    if (selectedOwner.length)   p.owner_id    = selectedOwner
    if (selectedClient.length)  p.customer_id = selectedClient
    if (showArchived)           p.include_archived = 1
    // Map view narrows the list server-side to the chosen circle (STRAAL-1).
    if (view === 'map') { p.lat = mapCenter.lat; p.lng = mapCenter.lng; p.radius = mapRadius }
    return p
  }, [globalSearch, statusBucket, selectedOwner, selectedClient, showArchived, view, mapCenter, mapRadius])
  const filterKey = JSON.stringify(filterParams)

  // Filters changed → back to page 1; the visible rows change → drop the selection.
  useEffect(() => { setPage(1) }, [filterKey])
  useEffect(() => { setSelectedIds(new Set()) }, [filterKey, page, pageSize])

  const notify = (type: string, text: string) => {
    setActionMsg({ type, text })
    if (msgTimer.current) clearTimeout(msgTimer.current)
    msgTimer.current = setTimeout(() => setActionMsg(null), 4000)
  }
  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current) }, [])

  // ── Data layer ──
  const { vacancies, setVacancies, loading, error, total, setTotal, lastPage, stats, customers } =
    useVacanciesData({ filterParams, page, pageSize, t })
  const s = stats as VacancyStatsShape | null
  const customerList = customers as { id: Id; name: string }[]

  // ── Drawer/record data layer (§3): selection + detail fetch + optimistic edits ──
  const { selected, detail, drawerExpanded, setDrawerExpanded, closeDrawer, selectVacancy, handleCreated, updateVacancy } =
    useVacancyRecord({ setVacancies, setTotal, statusMeta, users, customers: customerList, t })

  // Open a vacancy drawer when arriving via a cross-entity link (intent).
  useOpenFromIntent(intent, (id) => selectVacancy({ id } as Parameters<typeof selectVacancy>[0]))

  // Mirror the open drawer in the URL (?open=<id>): browser back/forward walks
  // through it and a copied link reopens the same vacancy (NAV-BACK-1;
  // supersedes the old memory-only remember).
  useDrawerUrl({
    selectedId: selected?.id,
    openById: (id) => selectVacancy({ id } as Parameters<typeof selectVacancy>[0]),
    close: closeDrawer, intent,
  })

  // ── Donut data (status / owner / client) — stats first, page-derived fallback ──
  const statusData = useMemo<Aggregate[]>(() => {
    if (s?.by_status) {
      // Stats carry bare uuid's; resolve label/colour via the lookup OR the loaded rows
      // (the seed created two status sets — VAC-SEED-1 — so the lookup alone can miss).
      const rowMeta = new Map(vacancies.filter(v => v.statusValue).map(v => [String(v.statusValue), { label: v.statusLabel, color: v.statusColor }]))
      return s.by_status.map(o => {
        const v = o.value ?? o.status
        // 41/71 seeded vacancies have NO status — a real, named segment (not clickable-to-nothing).
        if (v == null) return { name: t('insights.noStatus'), value: o.count ?? 0, key: '__none', color: '#9CA3AF' }
        const m = statusMeta(v)
        const rm = rowMeta.get(String(v))
        return { name: m.label || rm?.label || t('insights.noStatus'), value: o.count ?? 0, key: String(v), color: (m.label ? m.color : rm?.color) ?? '#9CA3AF' }
      })
    }
    return statuses.map(st => ({ name: st.label, key: st.value, color: st.color, value: vacancies.filter(v => v.statusValue === st.value).length })).filter(d => d.value > 0)
  }, [s, statuses, vacancies, statusMeta])
  const ownerData = useMemo<Aggregate[]>(() => {
    if (s?.by_owner) return s.by_owner.map(o => ({ name: o.name || '—', key: String(o.id ?? o.owner_id ?? ''), value: o.count ?? 0 })).filter(o => o.key !== '')
    const m: Record<string, Aggregate> = {}
    vacancies.forEach(v => { if (v.owner?.id != null) { const k = String(v.owner.id); (m[k] ??= { name: v.owner.name || '—', key: k, color: v.owner.color ?? undefined, value: 0 }).value++ } })
    return Object.values(m)
  }, [s, vacancies])
  const clientData = useMemo<Aggregate[]>(() => {
    if (s?.by_client) return s.by_client.map(o => ({ name: o.name || '—', key: String(o.id ?? o.customer_id ?? ''), value: o.count ?? 0 })).filter(o => o.key !== '')
    const m: Record<string, Aggregate> = {}
    vacancies.forEach(v => { if (v.clientId != null) { const k = String(v.clientId); (m[k] ??= { name: v.clientName || '—', key: k, value: 0 }).value++ } })
    return Object.values(m)
  }, [s, vacancies])

  // KPI cards = funnel-phase counts across applications.
  const phaseCounts = useMemo<Record<string, number>>(() => {
    if (s?.by_phase) {
      if (Array.isArray(s.by_phase)) return Object.fromEntries(s.by_phase.map(o => [o.value ?? o.phase, o.count ?? 0]))
      return s.by_phase
    }
    const acc: Record<string, number> = {}
    vacancies.forEach(v => Object.entries(v.applicationsByPhase ?? {}).forEach(([k, n]) => { acc[k] = (acc[k] ?? 0) + (Number(n) || 0) }))
    return acc
  }, [s, vacancies])

  // Option lists for the right-panel filters.
  const ownerOptions  = useMemo(() => ownerData.map(d => ({ value: d.key, label: d.name, count: d.value })), [ownerData])
  const clientOptions = useMemo(() => clientData.map(d => ({ value: d.key, label: d.name, count: d.value })), [clientData])

  const tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])
  const pickOne = (set: Dispatch<SetStateAction<string[]>>) => (v: string | undefined) => { if (v != null) toggleOneValue(set, v) }

  // Register the right-panel filters (owner + client; status is the tab bar).
  const catOrg = t('filters.categories.organisation')
  const filterGroups = useMemo(() => [
    { key: 'owner',  type: 'search-select', category: catOrg, label: t('filters.owner'),  selected: selectedOwner,  options: ownerOptions,  onToggle: tog(setSelectedOwner) },
    { key: 'client', type: 'search-select', category: catOrg, label: t('filters.client'), selected: selectedClient, options: clientOptions, onToggle: tog(setSelectedClient) },
  ], [t, catOrg, selectedOwner, selectedClient, ownerOptions, clientOptions])

  useEffect(() => {
    registerFilters('vacancies-page', filterGroups)
    return () => unregisterFilters('vacancies-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // ── Bulk actions ──
  const { toggleRow, toggleAll, bulkSetOwner, bulkSetStatus, bulkSetClient, bulkPublish, bulkRemoveTag, bulkAddNote, bulkArchive, selectedTags } =
    useVacancyBulkActions({ vacancies, setVacancies, setTotal, selectedIds, setSelectedIds, notify, t, statusMeta: statusMetaSafe })

  // ── Insights strip: 3 donuts + funnel-phase KPI cards ──
  const insightDonuts: DonutSpec[] = [
    { key: 'status', title: t('insights.statusTitle'), data: statusData,
      onPick: d => { const k = pickKey(d); setStatusBucket(prev => (prev === k ? 'all' : (k ?? 'all'))) },
      active: statusBucket !== 'all', onClear: () => setStatusBucket('all') },
    { key: 'owner',  title: t('insights.ownerTitle'),  data: ownerData,  onPick: d => pickOne(setSelectedOwner)(pickKey(d)),  active: selectedOwner.length > 0,  onClear: () => setSelectedOwner([]) },
    { key: 'client', title: t('insights.clientTitle'), data: clientData, onPick: d => pickOne(setSelectedClient)(pickKey(d)), active: selectedClient.length > 0, onClear: () => setSelectedClient([]) },
  ]
  // Shared clear-all (page memory keeps filters sticky).
  const anyFilterActive = Boolean(globalSearch.trim() || showArchived || statusBucket !== 'all'
    || selectedOwner.length || selectedClient.length)
  const [searchEpoch, setSearchEpoch] = useState(0)
  const clearAllFilters = () => {
    setSearchEpoch(e => e + 1); setGlobalSearch(''); setShowArchived(false); setStatusBucket('all')
    setSelectedOwner([]); setSelectedClient([]); setPage(1)
  }

  // Funnel counts are APPLICATION numbers — clicking jumps to Sollicitaties with that
  // stage pre-filtered (Danny's "Gesolliciteerd doet niks": these cards had no click).
  const insightKpis: KpiSpec[] = phases.map(p => ({
    key: p.value, label: t(`kpi.${p.value}`, p.label), value: phaseCounts[p.value] ?? 0, color: p.color,
    onClick: () => navigate('applications', { stage: p.value }),
  }))

  // Status tab bar: "All" + one button per configured status.
  const buckets = [{ value: 'all', label: t('buckets.all') }, ...statuses.map(st => ({ value: st.value, label: st.label }))]

  return (
    <>
      {addOpen && <AddVacancyModal onClose={() => setAddOpen(false)} onCreated={v => { setAddOpen(false); handleCreated(v) }} users={users} customers={customerList} />}
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* KPI block: donuts + funnel-phase KPI cards */}
          <InsightsRow donuts={insightDonuts} kpis={insightKpis} clearTitle={t('insights.clearFilter')} />

          {/* Add/bulk on the left (like Candidates/Applications); status tabs pushed right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '0 24px 12px', minHeight: 36, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {selectedIds.size > 0 ? (
                <VacanciesBulkBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}
                  onSetOwner={bulkSetOwner} onSetStatus={bulkSetStatus} onSetClient={bulkSetClient}
                  onPublish={() => bulkPublish(true)} onUnpublish={() => bulkPublish(false)}
                  onRemoveTag={bulkRemoveTag} onAddNote={bulkAddNote} onArchive={bulkArchive}
                  canArchive={hasPermission('vacancies.delete')}
                  users={users} statuses={statuses} customers={customerList} selectedTags={selectedTags} />
              ) : (
                <>
                  <button onClick={() => setAddOpen(true)} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 500,
                    background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                    + {t('page.add')}
                  </button>
                  {/* Shared header search (T10) — debounced, drives the same server-side ?search=. */}
                  <HeaderSearch key={searchEpoch} onSearch={setGlobalSearch} defaultValue={globalSearch}
                    placeholder={t('page.searchPlaceholder')} width={300} />
                  <ClearFiltersButton active={anyFilterActive} onClear={clearAllFilters} />
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
              {/* Archived (soft-deleted) — shared quick-view toggle (§4). */}
              <QuickViewToggle active={showArchived} onToggle={() => setShowArchived(v => !v)}
                label={t('page.archivedView')} icon={Archive} />
              {/* STRAAL-1: table ⇄ map (radius search) — always shown, mirroring the
                  candidate blueprint (the API ships lat/lng + distance_km now). */}
              <QuickViewToggle active={view === 'map'} onToggle={() => setView(x => (x === 'map' ? 'table' : 'map'))}
                label={t('common:map.view')} color="var(--color-primary)" icon={MapIcon} />
              {buckets.map(b => (
                <button key={b.value} onClick={() => setStatusBucket(b.value)}
                  style={{ padding: '5px 14px', fontSize: 13, fontWeight: statusBucket === b.value ? 600 : 400, borderRadius: 7, cursor: 'pointer',
                    background: statusBucket === b.value ? 'var(--color-primary)' : 'transparent',
                    color: statusBucket === b.value ? '#fff' : 'var(--text)',
                    border: statusBucket === b.value ? 'none' : '1px solid var(--border)' }}>
                  {b.label}
                </button>
              ))}
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

          {/* Map view (STRAAL-1 v2, mirrors candidates): map LEFT, the filtered vacancy
              table RIGHT — one radius search drives both panes. Lazy Leaflet load. */}
          {view === 'map' ? (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14, padding: '0 24px 16px' }}>
              <div style={{ flex: '1.1 1 0', minWidth: 400, display: 'flex', flexDirection: 'column' }}>
                <Suspense fallback={<div style={{ padding: 24, fontSize: 12, color: 'var(--text-muted)' }}>{t('common:map.loading')}</div>}>
                  <VacanciesMapView rows={vacancies} padded={false} center={mapCenter} radiusKm={mapRadius}
                    onCenterChange={(lat, lng) => setMapCenter({ lat, lng })} onRadiusChange={setMapRadius}
                    onPick={id => selectVacancy({ id } as Parameters<typeof selectVacancy>[0])} />
                </Suspense>
              </div>
              {/* Right pane: the same server-filtered rows as a table (row click = drawer). */}
              <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                  {error && (
                    <ErrorBanner style={{ marginBottom: 12 }}>{error}</ErrorBanner>
                  )}
                  <VacanciesTable rows={vacancies} loading={loading} selectedId={selected?.id} onSelect={selectVacancy} />
                </div>
                <PaginationBar page={page} totalPages={lastPage} totalRows={total} pageSize={pageSize}
                  onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />
              </div>
            </div>
          ) : (
            <>
              {/* Table */}
              <div ref={tableScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
                {error && (
                  <ErrorBanner style={{ marginBottom: 12 }}>{error}</ErrorBanner>
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
                  scrollParentRef={tableScrollRef}
                />
              </div>

              <PaginationBar page={page} totalPages={lastPage} totalRows={total} pageSize={pageSize}
                onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />
            </>
          )}
        </div>

        {/* Drawer — remounts (key) when the full detail arrives so tabs re-init */}
        <VacancyDrawer
          key={selected ? `${selected.id}-${detail ? 'full' : 'lite'}` : 'none'}
          vacancy={(detail ?? selected) as VacancyDetail | null}
          onClose={closeDrawer}
          expanded={drawerExpanded}
          onToggleExpand={() => setDrawerExpanded(v => !v)}
          onUpdate={updateVacancy}
          users={users}
        />
      </div>
    </>
  )
}

// Page-scoped provider so the table/drawer/modal/bulk share one lookups fetch.
export default function VacanciesPage({ intent }: { intent?: unknown } = {}) {
  return (
    <VacancyLookupsProvider>
      <VacanciesPageInner intent={intent} />
    </VacancyLookupsProvider>
  )
}
