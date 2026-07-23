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
import { Archive, Map as MapIcon, BotOff } from 'lucide-react'
import { useRightPanel } from '@/context/RightPanelContext'
import { useAuth } from '@/context/AuthContext'
import { useUsers } from '@/lib/queries'
import { isReferenceQuery } from '@/lib/referenceNumber'
import ErrorBanner from '@/components/ui/ErrorBanner'
import ActionMessageBanner from '@/components/ui/ActionMessageBanner'
import { VacancyLookupsProvider, useVacancyLookups } from '@/context/VacancyLookupsContext'
import InsightsRow from '@/components/insights/InsightsRow'
import PaginationBar from '@/components/ui/PaginationBar'
import HeaderSearch from '@/components/ui/HeaderSearch'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import VacanciesTable from './VacanciesTable'
import VacanciesBulkBar from './VacanciesBulkBar'
import VacancyDrawer from './VacancyDrawer'
import AddVacancyModal from './AddVacancyModal'
import { toggleOneValue } from './data/vacanciesShared'
import { buildVacancyInsightsConfig } from './data/vacancyInsightsConfig'
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
  // V28: functie filter — the by_category donut's click-to-filter target (existing
  // BE `category[]` param, VacancyQuery::filtered()).
  const [selectedCategory, setSelectedCategory] = usePageMemory<string[]>('vac.category', [])
  const [globalSearch,   setGlobalSearch]   = usePageMemory('vac.search', '')
  const [showArchived,   setShowArchived]   = usePageMemory('vac.archived', false)
  // VAC-AGENT-1: "online without an AI agent" quick view (?without_agent=1).
  const [showWithoutAgent, setShowWithoutAgent] = usePageMemory('vac.withoutAgent', false)
  // VAC-KPI-REDESIGN 22-07: the AI-agent donut's "real agent" segment click (?agent_id=).
  // Mutually exclusive with showWithoutAgent — see toggleWithoutAgent + the 'agent'
  // donut's onPick below, which keep only one of the two ever set.
  const [selectedAgentId, setSelectedAgentId] = usePageMemory<string | null>('vac.agent', null)
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
    // V28: functie donut filter — VacancyQuery::filtered() already whereIn's on function_title.
    if (selectedCategory.length) p.category  = selectedCategory
    if (showArchived)           p.include_archived = 1
    // VAC-AGENT-1: quick view onto the vacancies that are online but have no agent linked.
    if (showWithoutAgent)       p.without_agent = 1
    // VAC-KPI-REDESIGN 22-07: the AI-agent donut's real-agent segment click.
    else if (selectedAgentId)   p.agent_id = selectedAgentId
    // V27: server-side published/unpublished filter (honoured by both the list and
    // stats). Laravel's `boolean` rule only accepts true/false/0/1/'0'/'1' — NOT the
    // strings "true"/"false" a JS boolean serialises to in a query string — so this
    // sends 1/0 (numeric), mirroring `include_archived`/`no_status` above (a real
    // 422 caught by the live read-only probe before this fix).
    if (publishedBucket !== 'all') p.published = publishedBucket === 'published' ? 1 : 0
    // Map view narrows the list server-side to the chosen circle (STRAAL-1).
    if (view === 'map' && mapStraalActive) { p.lat = mapCenter.lat; p.lng = mapCenter.lng; p.radius = mapRadius }
    return p
  }, [globalSearch, statusBucket, selectedOwner, selectedClient, selectedCategory, showArchived, showWithoutAgent, selectedAgentId, publishedBucket, view, mapCenter, mapRadius, mapStraalActive])
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
  const { selected, detail, drawerExpanded, setDrawerExpanded, closeDrawer, selectVacancy, handleCreated, updateVacancy, restoreVacancy } =
    useVacancyRecord({ setVacancies, setTotal, statusMeta, users, customers: customerList, t })

  // VACANCY-MATCH-COUNT-1 (Danny 23-07): the drawer's deep-link target tab. The
  // table's Leads count opens straight on "candidateSearch"; every other entry
  // point (row click, map pick, intent, URL) opens on the default tab, so those
  // reset it via openVacancy below (mirrors CustomerRecord's drawerTab, kept here
  // instead since useVacancyRecord.ts is out of scope for this change).
  const [drawerInitialTab, setDrawerInitialTab] = useState<string | undefined>(undefined)
  const openVacancy = (v: Parameters<typeof selectVacancy>[0]) => { setDrawerInitialTab(undefined); selectVacancy(v) }
  const openCandidateSearch = (id: Id) => { setDrawerInitialTab('candidateSearch'); selectVacancy({ id } as Parameters<typeof selectVacancy>[0], { forceOpen: true }) }

  // Open a vacancy drawer when arriving via a cross-entity link (intent).
  useOpenFromIntent(intent, (id) => openVacancy({ id } as Parameters<typeof selectVacancy>[0]))

  // Mirror the open drawer in the URL (?open=<id>): browser back/forward walks
  // through it and a copied link reopens the same vacancy (NAV-BACK-1;
  // supersedes the old memory-only remember).
  useDrawerUrl({
    selectedId: selected?.id,
    openById: (id) => openVacancy({ id } as Parameters<typeof selectVacancy>[0]),
    close: closeDrawer, intent,
  })

  // ── Insights derivation (7 donuts: status/owner/client/category/published/funnel/agent
  // + the 2 KPI cards below) ──
  const { statusData, ownerData, clientData, publishedData, categoryData, funnelData, agentData, applicationsTotal } =
    useVacancyInsights({ stats, vacancies, statuses, phases, statusMeta, t })

  // Option lists for the right-panel filters.
  const ownerOptions    = useMemo(() => ownerData.map(d => ({ value: d.key, label: d.name, count: d.value })), [ownerData])
  const clientOptions   = useMemo(() => clientData.map(d => ({ value: d.key, label: d.name, count: d.value })), [clientData])
  const categoryOptions = useMemo(() => categoryData.map(d => ({ value: d.key, label: d.name, count: d.value })), [categoryData])

  const tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])
  const pickOne = (set: Dispatch<SetStateAction<string[]>>) => (v: string | undefined) => { if (v != null) toggleOneValue(set, v) }

  // Register the right-panel filters (owner + client + functie; status is the tab bar).
  const catOrg = t('filters.categories.organisation')
  const filterGroups = useMemo(() => [
    { key: 'owner',    type: 'search-select', category: catOrg, label: t('filters.owner'),    selected: selectedOwner,    options: ownerOptions,    onToggle: tog(setSelectedOwner) },
    { key: 'client',   type: 'search-select', category: catOrg, label: t('filters.client'),   selected: selectedClient,   options: clientOptions,   onToggle: tog(setSelectedClient) },
    { key: 'category', type: 'search-select', category: catOrg, label: t('filters.category'), selected: selectedCategory, options: categoryOptions, onToggle: tog(setSelectedCategory) },
  ], [t, catOrg, selectedOwner, selectedClient, selectedCategory, ownerOptions, clientOptions, categoryOptions])

  useEffect(() => {
    registerFilters('vacancies-page', filterGroups)
    return () => unregisterFilters('vacancies-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // ── Bulk actions ──
  const { toggleRow, toggleAll, bulkSetOwner, bulkSetStatus, bulkSetClient, bulkPublish, bulkRemoveTag, bulkAddNote, bulkArchive, selectedTags, dialog: bulkConfirmDialog } =
    useVacancyBulkActions({ vacancies, setVacancies, setTotal, selectedIds, setSelectedIds, notify, t, statusMeta: statusMetaSafe })

  // VAC-KPI-REDESIGN 22-07: toggling "no agent" always clears the picked real-agent
  // id (mutually exclusive) — shared by the toolbar QuickViewToggle, the agent
  // donut's "Geen agent" segment and the "Zonder AI-agent" KPI card below.
  const toggleWithoutAgent = () => { setSelectedAgentId(null); setShowWithoutAgent(v => !v) }

  // ── Insights strip: 7 donuts + 2 KPI cards (VAC-KPI-REDESIGN 22-07 — was 5
  // donuts + 6 funnel-KPI cards = 11 tiles; the array/onPick wiring itself lives in
  // vacancyInsightsConfig.ts, extracted once this page crossed ~400 lines). ──
  const { donuts: insightDonuts, kpis: insightKpis } = buildVacancyInsightsConfig({
    t, navigate, statusData, ownerData, clientData, categoryData, publishedData, funnelData, agentData,
    statusBucket, setStatusBucket,
    selectedOwner, pickOwner: pickOne(setSelectedOwner), clearOwner: () => setSelectedOwner([]),
    selectedClient, pickClient: pickOne(setSelectedClient), clearClient: () => setSelectedClient([]),
    selectedCategory, pickCategory: pickOne(setSelectedCategory), clearCategory: () => setSelectedCategory([]),
    publishedBucket, setPublishedBucket,
    selectedAgentId, setSelectedAgentId, showWithoutAgent, setShowWithoutAgent, toggleWithoutAgent,
    applicationsTotal,
  })
  // Shared clear-all (page memory keeps filters sticky).
  const anyFilterActive = Boolean(globalSearch.trim() || showArchived || showWithoutAgent || Boolean(selectedAgentId) || statusBucket !== 'all'
    || selectedOwner.length || selectedClient.length || selectedCategory.length || publishedBucket !== 'all')
  const [searchEpoch, setSearchEpoch] = useState(0)
  const clearAllFilters = () => {
    setSearchEpoch(e => e + 1); setGlobalSearch(''); setShowArchived(false); setShowWithoutAgent(false); setSelectedAgentId(null); setStatusBucket('all')
    setSelectedOwner([]); setSelectedClient([]); setSelectedCategory([]); setPublishedBucket('all'); setPage(1)
  }

  // Status tab bar: "All" + one button per configured status.
  const buckets = [{ value: 'all', label: t('buckets.all') }, ...statuses.map(st => ({ value: st.value, label: st.label }))]

  return (
    <>
      {addOpen && <AddVacancyModal onClose={() => setAddOpen(false)} onCreated={v => { setAddOpen(false); handleCreated(v) }} users={users} customers={customerList} />}
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* KPI block: 7 donuts + 2 KPI cards (VAC-KPI-REDESIGN 22-07 — 9 tiles total).
              V27: the published donut is a real server-wide aggregate, so no more
              STATS-OOM-1 honesty notice here; the agent donut's own honest-gate lives
              in useVacancyInsights.ts (agentData) until VAC-STATS-BYAGENT-1 lands. */}
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
              {/* VAC-AGENT-1: "online without an AI agent" quick view — --color-violet is
                  the shared system/AI-ish accent token (index.css), not an ad-hoc hex.
                  Shares toggleWithoutAgent with the agent donut's "Geen agent" segment
                  and the "Zonder AI-agent" KPI card (VAC-KPI-REDESIGN 22-07). */}
              <QuickViewToggle active={showWithoutAgent} onToggle={toggleWithoutAgent}
                label={t('page.withoutAgentView')} color="var(--color-violet)" icon={BotOff} />
              {/* Bucket tabs — soft-tinted active (§4: never a solid fill); mirrors
                  ApplicationsPage's identical bucket control verbatim. */}
              {buckets.map(b => (
                <button key={b.value} onClick={() => setStatusBucket(b.value)}
                  style={{ padding: '5px 14px', fontSize: 13, fontWeight: statusBucket === b.value ? 600 : 400, borderRadius: 7, cursor: 'pointer',
                    background: statusBucket === b.value ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)' : 'transparent',
                    color: statusBucket === b.value ? 'var(--color-primary)' : 'var(--text)',
                    border: `1px solid ${statusBucket === b.value ? 'color-mix(in srgb, var(--color-primary) 45%, transparent)' : 'var(--border)'}` }}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Transient feedback for bulk mutations — audit R1 item 5: this was a
              copy-pasted role=status banner (mirrored in Candidates/Customers); now
              the ONE shared component (§3A). */}
          <ActionMessageBanner msg={actionMsg} onDismiss={() => setActionMsg(null)} dismissLabel={t('common:close')} />

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
                    onPick={id => openVacancy({ id } as Parameters<typeof selectVacancy>[0])} />
                </Suspense>
              </div>
              {/* Right pane: the same server-filtered rows as a table (row click = drawer). */}
              <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                  {error && (
                    <ErrorBanner style={{ marginBottom: 12 }}>{error}</ErrorBanner>
                  )}
                  <VacanciesTable rows={vacancies} loading={loading} selectedId={selected?.id} onSelect={openVacancy}
                    onOpenCandidateSearch={openCandidateSearch} />
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
                  onSelect={openVacancy}
                  onOpenCandidateSearch={openCandidateSearch}
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
          onRestore={hasPermission('vacancies.update') ? restoreVacancy : undefined}
          users={users}
          initialTab={drawerInitialTab}
        />
        {bulkConfirmDialog}
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
