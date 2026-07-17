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
import { useVacancyInsights } from './hooks/useVacancyInsights'
import { useOpenFromIntent } from '@/context/NavigationContext'
import { BTN_H } from '@/config/buttonMetrics'
import { useVacancyBulkActions } from './hooks/useVacancyBulkActions'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

// STRAAL-1: Leaflet only loads when the map view opens (§9 — lazy heavy deps).
const VacanciesMapView = lazy(() => import('./VacanciesMapView'))

interface AppUser { id: Id; name: string }

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
  // V27: Gepubliceerd/Niet-gepubliceerd — a real server-side filter (VacancyQuery::
  // rules()/filtered() already accept a `published` boolean on both /vacancies and
  // /vacancies/stats), just never wired into the UI before.
  const [publishedBucket, setPublishedBucket] = usePageMemory<'all' | 'published' | 'unpublished'>('vac.published', 'all')
  // STRAAL-1: map view + radius-search state (server-side ?lat=&lng=&radius=).
  const [view,      setView]      = usePageMemory<'table' | 'map'>('vac.viewMode', 'table')
  const [mapCenter, setMapCenter] = usePageMemory('vac.mapCenter', { lat: 52.09, lng: 5.12 })
  const [mapRadius, setMapRadius] = usePageMemory('vac.mapRadius', 30)
  // The straal filters ONLY after the user activates it (map click / radius
  // change) — switching to Kaart used to hide everything outside a silent
  // 30km-Utrecht circle (Danny 14/7).
  const [mapStraalActive, setMapStraalActive] = usePageMemory('vac.mapStraal', false)

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
    // V27: server-side published/unpublished filter (honoured by both the list and
    // stats). Laravel's `boolean` rule only accepts true/false/0/1/'0'/'1' — NOT the
    // strings "true"/"false" a JS boolean serialises to in a query string — so this
    // sends 1/0 (numeric), mirroring `include_archived`/`no_status` above (a real
    // 422 caught by the live read-only probe before this fix).
    if (publishedBucket !== 'all') p.published = publishedBucket === 'published' ? 1 : 0
    // Map view narrows the list server-side to the chosen circle (STRAAL-1).
    if (view === 'map' && mapStraalActive) { p.lat = mapCenter.lat; p.lng = mapCenter.lng; p.radius = mapRadius }
    return p
  }, [globalSearch, statusBucket, selectedOwner, selectedClient, showArchived, publishedBucket, view, mapCenter, mapRadius, mapStraalActive])
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

  // ── Insights derivation (status/owner/client/published donuts + phase KPI counts) ──
  const { statusData, ownerData, clientData, publishedData, phaseCounts, publishedNotice } =
    useVacancyInsights({ stats, vacancies, total, statuses, statusMeta, t })

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

  // ── Insights strip: 4 donuts + funnel-phase KPI cards ──
  const insightDonuts: DonutSpec[] = [
    { key: 'status', title: t('insights.statusTitle'), data: statusData,
      onPick: d => { const k = pickKey(d); setStatusBucket(prev => (prev === k ? 'all' : (k ?? 'all'))) },
      active: statusBucket !== 'all', onClear: () => setStatusBucket('all') },
    { key: 'owner',  title: t('insights.ownerTitle'),  data: ownerData,  onPick: d => pickOne(setSelectedOwner)(pickKey(d)),  active: selectedOwner.length > 0,  onClear: () => setSelectedOwner([]) },
    { key: 'client', title: t('insights.clientTitle'), data: clientData, onPick: d => pickOne(setSelectedClient)(pickKey(d)), active: selectedClient.length > 0, onClear: () => setSelectedClient([]) },
    // V27: click a segment → publishedBucket ('published'/'unpublished'); click again clears.
    { key: 'published', title: t('insights.publishedTitle'), data: publishedData,
      onPick: d => { const k = pickKey(d); setPublishedBucket(prev => (prev === k ? 'all' : (k === 'published' || k === 'unpublished' ? k : 'all'))) },
      active: publishedBucket !== 'all', onClear: () => setPublishedBucket('all') },
  ]
  // Shared clear-all (page memory keeps filters sticky).
  const anyFilterActive = Boolean(globalSearch.trim() || showArchived || statusBucket !== 'all'
    || selectedOwner.length || selectedClient.length || publishedBucket !== 'all')
  const [searchEpoch, setSearchEpoch] = useState(0)
  const clearAllFilters = () => {
    setSearchEpoch(e => e + 1); setGlobalSearch(''); setShowArchived(false); setStatusBucket('all')
    setSelectedOwner([]); setSelectedClient([]); setPublishedBucket('all'); setPage(1)
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
          <InsightsRow donuts={insightDonuts} kpis={insightKpis} clearTitle={t('insights.clearFilter')} notice={publishedNotice} />

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
                  {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
                  <button onClick={() => setAddOpen(true)} style={{ display: 'flex', alignItems: 'center', height: BTN_H, padding: '0 14px', fontSize: 13, fontWeight: 600,
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
                label={t('page.archivedView')} color="var(--color-archive)" icon={Archive} />
              {/* STRAAL-1: table ⇄ map (radius search) — always shown, mirroring the
                  candidate blueprint (the API ships lat/lng + distance_km now). */}
              <QuickViewToggle active={view === 'map'} onToggle={() => setView(x => (x === 'map' ? 'table' : 'map'))}
                label={t('common:map.view')} color="var(--color-map)" icon={MapIcon} />
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
                  <VacanciesMapView rows={vacancies} padded={false} center={mapCenter} radiusKm={mapStraalActive ? mapRadius : 0}
                    onCenterChange={(lat, lng) => { setMapCenter({ lat, lng }); setMapStraalActive(true) }}
                    onRadiusChange={(km: number) => { setMapRadius(km); setMapStraalActive(true) }}
                    onClearRadius={mapStraalActive ? () => setMapStraalActive(false) : undefined}
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
