/**
 * VacanciesPage — the vacancy list surface (mirrors the candidate blueprint).
 * Thin container: owns UI state (filters, selection, drawer), composes the data
 * hook (customers/list/stats) and the bulk-actions hook, derives the donut data
 * + filters, and renders the insights row + status tabs + table + drawer. Page-
 * scoped VacancyLookupsProvider so the table/drawer/modal/bulk share one fetch.
 */
import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { useRightPanel } from '@/context/RightPanelContext'
import { useAuth } from '@/context/AuthContext'
import { usePublishSelection } from '@/context/SelectionContext'
import { useUsers } from '@/lib/queries'
import { useBranchOptions } from '@/lib/useBranchOptions'
import ErrorBanner from '@/components/ui/ErrorBanner'
import ActionMessageBanner from '@/components/ui/ActionMessageBanner'
import { VacancyLookupsProvider, useVacancyLookups } from '@/context/VacancyLookupsContext'
import InsightsRow from '@/components/insights/InsightsRow'
import PaginationBar from '@/components/ui/PaginationBar'
import ViewSwitch from '@/components/ui/ViewSwitch'
import VacanciesTable from './VacanciesTable'
import VacanciesBulkBar from './VacanciesBulkBar'
import VacanciesToolbar from './VacanciesToolbar'
import VacancyDrawer from './VacancyDrawer'
import AddVacancyModal from './AddVacancyModal'
import { toggleOneValue } from './data/vacanciesShared'
import { buildVacancyInsightsConfig } from './data/vacancyInsightsConfig'
import { useNavigation } from '@/context/NavigationContext'
import { useDrawerUrl } from '@/hooks/useDrawerUrl'
import { usePageMemory } from '@/lib/usePageMemory'
import { useListPageSize } from '@/hooks/useListPageSize'
import { useVacanciesData, VACANCIES_MAX_PER_PAGE } from './hooks/useVacanciesData'
import type { VacancySort } from './hooks/useVacanciesData'
import type { ControlledSort } from '@/components/ui/DataTable'
import { useVacancyFilterParams } from './hooks/useVacancyFilterParams'
import { buildVacancyFilterGroups } from './data/vacancyFilterGroups'
import { geocodeNL } from '@/lib/geocode'
import { useAiAgents } from './hooks/useAiAgents'
import { useVacancyRecord } from './hooks/useVacancyRecord'
import { useVacancyInsights } from './hooks/useVacancyInsights'
import { useOpenFromIntent } from '@/context/NavigationContext'
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
  // VESTIGING-2: the branch values this user may filter on — see useBranchOptions for
  // why an empty scope means unrestricted rather than none.
  const branchOptions = useBranchOptions()

  const [page,      setPage]      = usePageMemory('vac.page', 1)
  // Column sort item 4 (DATATABLE-SORT-1 reference adoption): lifted controlled
  // sort, mirrors ApplicationsPage's `sort`/`setSort`. Unmapped columns (see
  // VACANCY_SORT_KEYS) still reorder the loaded page locally via DataTable.
  const [sort, setSort] = usePageMemory<VacancySort | null>('vac.sort', null)
  // Shared page-size hook (§ audit 2026-08-05): seeds from the user's
  // default_per_page, clamps to VacancyQuery's real per_page ceiling (200) so a
  // 500 preference never 422s ("klapt eruit"), and stays sticky across the
  // shell's unmount-on-navigate — this page used to hardcode 50, ignoring the
  // tenant preference entirely.
  const { pageSize, setPageSize, options: pageSizeOptions } = useListPageSize('vac', VACANCIES_MAX_PER_PAGE)
  const [addOpen,        setAddOpen]        = useState(false)
  const [selectedIds,    setSelectedIds]    = useState<Set<Id>>(() => new Set())
  // KOIOS-SELECTIE-CONTEXT-1: mirror the selection into Koios AI's context chip.
  usePublishSelection('vacancies', selectedIds)
  const [actionMsg,      setActionMsg]      = useState<{ type: string; text: string } | null>(null)
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Server-side filter dimensions. Status is driven by the tab bar (single value).
  const [statusBucket,   setStatusBucket]   = usePageMemory('vac.status', 'all')
  const [selectedOwner,  setSelectedOwner]  = usePageMemory<string[]>('vac.owner', [])
  const [selectedClient, setSelectedClient] = usePageMemory<string[]>('vac.client', [])
  // V28: functie filter — the by_category donut's click-to-filter target (existing
  // BE `category[]` param, VacancyQuery::filtered()).
  const [selectedCategory, setSelectedCategory] = usePageMemory<string[]>('vac.category', [])
  // VESTIGING-2: explicit branch filter (narrows within what the user may already
  // see — server excludes records with no branch, see the notice below).
  const [selectedBranch, setSelectedBranch] = usePageMemory<string[]>('vac.branch', [])
  const [globalSearch,   setGlobalSearch]   = usePageMemory('vac.search', '')
  const [showArchived,   setShowArchived]   = usePageMemory('vac.archived', false)
  // TRASH-OVERAL-2: Prullenbak view (lifecycle pending_erase) — same include_archived
  // request, split client-side; mutually exclusive with the archived view (mirrors candidates).
  const [showTrash,      setShowTrash]      = usePageMemory('vac.trash', false)
  // VAC-AGENT-1: "online without an AI agent" quick view (?without_agent=1).
  const [showWithoutAgent, setShowWithoutAgent] = usePageMemory('vac.withoutAgent', false)
  // VAC-KPI-REDESIGN 22-07: the AI-agent donut's "real agent" segment click (?agent_id=).
  // Mutually exclusive with showWithoutAgent — see toggleWithoutAgent + the 'agent'
  // donut's onPick below, which keep only one of the two ever set.
  const [selectedAgentId, setSelectedAgentId] = usePageMemory<string | null>('vac.agent', null)
  // VAC-HAS-APPLICATIONS-1: "only vacancies with applications" — a real server-side
  // filter (VacancyQuery BOOLEAN_FILTERS → whereHas('applications')), driven by the
  // applications KPI card. Before this landed the card could not filter at all.
  const [hasApplications, setHasApplications] = usePageMemory('vac.hasApplications', false)
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
  // D1(a): the dashboard tiles' semantic attention intent — null | 'closingSoon' | 'staleStatus'.
  const [attention, setAttention] = usePageMemory<string | null>('vac.attention', null)
  // FILTER-PARITY-1: sidebar radius filter (mirrors the customer page's geoFilter),
  // separate from the map view's own straal control above.
  const [geoFilter, setGeoFilter] = usePageMemory<{ q: string; km: number; lat: number; lng: number; label: string } | null>('vac.geo', null)
  const [geoHint, setGeoHint] = useState<string | null>(null)

  const handlePageSizeChange = (newSize: number) => { setPageSize(newSize); setPage(1) }

  // Server-side filter params (axios serialises arrays as `key[]`). The exact wire
  // shape lives in its own hook so it stays unit-testable (§3 size discipline).
  const filterParams = useVacancyFilterParams({
    globalSearch, statusBucket, selectedOwner, selectedClient, selectedCategory, selectedBranch,
    showArchived, showTrash, showWithoutAgent, selectedAgentId, hasApplications, publishedBucket,
    view, mapCenter, mapRadius, mapStraalActive, attention,
    geoFilter: geoFilter ? { lat: geoFilter.lat, lng: geoFilter.lng, km: geoFilter.km } : null,
  })
  const filterKey = JSON.stringify(filterParams)

  // Filters changed → back to page 1; the visible rows change → drop the selection.
  useEffect(() => { setPage(1) }, [filterKey, setPage])
  // Column sort item 4: a new sort also resets to page 1 (mirrors ApplicationsPage).
  useEffect(() => { setPage(1) }, [sort, setPage])

  const notify = (type: string, text: string) => {
    setActionMsg({ type, text })
    if (msgTimer.current) clearTimeout(msgTimer.current)
    msgTimer.current = setTimeout(() => setActionMsg(null), 4000)
  }
  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current) }, [])

  // ── Data layer ──
  const { vacancies, setVacancies, loading, error, total, setTotal, lastPage, stats, customers, refresh, rowsEpoch, fetching } =
    useVacanciesData({ filterParams, page, pageSize, t, sort })
  const customerList = customers as { id: Id; name: string }[]

  // SELECT-RACE-1: rowsEpoch (bumped only when a NEW server result actually
  // lands, see useVacanciesData) closes the race where a select-all made
  // against the stale rows during a filter/page fetch survived the swap — the
  // input-triggered clear above fires too early to catch that window on its own.
  useEffect(() => { setSelectedIds(new Set()) }, [filterKey, page, pageSize, rowsEpoch])

  // Three lifecycle views (TRASH-OVERAL-2, mirrors candidates): trash = pending_erase,
  // archived = archived only (so pending rows never double-show), default = not
  // soft-deleted (belt-and-braces — the server already omits them without the flag).
  const visibleRows = useMemo(() =>
    vacancies.filter(v =>
      showTrash ? v.lifecycle === 'pending_erase'
      : showArchived ? v.lifecycle === 'archived'
      : !v.archived),
  [vacancies, showArchived, showTrash])

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
  // V4 (vacatures-tabel-cluster): the Sollicitaties count deep-links to the
  // drawer's "applicants" tab (already registered in VacancyDrawer's TABS).
  const openApplicants = (id: Id) => { setDrawerInitialTab('applicants'); selectVacancy({ id } as Parameters<typeof selectVacancy>[0], { forceOpen: true }) }
  // V-table-2: the Matches count deep-links to the drawer's read-only "matches" tab.
  const openMatches = (id: Id) => { setDrawerInitialTab('matches'); selectVacancy({ id } as Parameters<typeof selectVacancy>[0], { forceOpen: true }) }

  // Open a vacancy drawer when arriving via a cross-entity link (intent).
  // K7c: an intent may carry a `tab` (customer drawer's applications ghost-link) —
  // land on that tab instead of the default, forcing the drawer open like the
  // in-page openApplicants/openMatches callbacks above.
  useOpenFromIntent(intent, (id, tab) => {
    if (tab) { setDrawerInitialTab(tab); selectVacancy({ id } as Parameters<typeof selectVacancy>[0], { forceOpen: true }) }
    else openVacancy({ id } as Parameters<typeof selectVacancy>[0])
  })

  // D1(a): seed the closing-soon / stale-status filter from a dashboard tile's
  // semantic attention intent (mirrors ApplicationsPage/CandidatesPage's own intent seam).
  useEffect(() => {
    const i = intent as { attention?: string } | undefined
    if (i?.attention) setAttention(i.attention)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setAttention is a stable usePageMemory setter; seeding fires per new intent only (house pattern, see AddApplicationModal:198)
  }, [intent])

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
  const statusOptions   = useMemo(() => statuses.map(s => ({ value: s.value, label: s.label, color: s.color })), [statuses])
  const agentOptions    = useMemo(() => agentData.map(d => ({ value: d.key, label: d.name, count: d.value })), [agentData])

  const tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])
  const pickOne = (set: Dispatch<SetStateAction<string[]>>) => (v: string | undefined) => { if (v != null) toggleOneValue(set, v) }

  // FILTER-PARITY-1: PDOK-geocode a place/postcode for the sidebar radius filter
  // (mirrors CustomersPage's own applyGeo). Stabilized (useCallback) so the
  // filterGroups useMemo below can safely depend on it — every captured setter
  // is itself stable, only `t` can genuinely change.
  const applyGeo = useCallback(async (q: string, km: number) => {
    setGeoHint(null)
    const hit = await geocodeNL(q)
    if (!hit) { setGeoHint(t('common:filters.notFound')); return }
    setGeoFilter({ q, km, lat: hit.lat, lng: hit.lng, label: `${hit.label} · ${km} km` })
  }, [t, setGeoHint, setGeoFilter])
  const clearGeo = useCallback(() => { setGeoFilter(null); setGeoHint(null) }, [setGeoFilter, setGeoHint])

  // Register the right-panel filters. Config lives in the data/ builder (mirrors
  // buildCandidateFilterGroups/buildCustomerFilterGroups) — owner/client/functie/
  // branch here, status/published/agent/has-applications/archived/geo there.
  const catOrg = t('filters.categories.organisation')
  const filterGroups = useMemo(() => [
    { key: 'owner',    type: 'search-select', category: catOrg, label: t('filters.owner'),    selected: selectedOwner,    options: ownerOptions,    onToggle: tog(setSelectedOwner) },
    { key: 'client',   type: 'search-select', category: catOrg, label: t('filters.client'),   selected: selectedClient,   options: clientOptions,   onToggle: tog(setSelectedClient) },
    { key: 'category', type: 'search-select', category: catOrg, label: t('filters.category'), selected: selectedCategory, options: categoryOptions, onToggle: tog(setSelectedCategory) },
    // VESTIGING-2: values limited to the user's own branch scope (measured above).
    { key: 'branch',   type: 'search-select', category: catOrg, label: t('common:filters.branch'), selected: selectedBranch, options: branchOptions, onToggle: tog(setSelectedBranch) },
    ...buildVacancyFilterGroups({
      t,
      filters: {
        statusBucket, setStatusBucket, publishedBucket, setPublishedBucket,
        selectedAgentId, setSelectedAgentId, showWithoutAgent, setShowWithoutAgent,
        hasApplications, setHasApplications, showArchived, setShowArchived,
        geoFilter, geoHint, applyGeo, clearGeo,
      },
      options: { statusOptions, agentOptions },
    }),
  ], [t, catOrg, selectedOwner, setSelectedOwner, selectedClient, setSelectedClient, selectedCategory, setSelectedCategory,
    selectedBranch, setSelectedBranch, ownerOptions, clientOptions, categoryOptions, branchOptions,
    statusBucket, setStatusBucket, publishedBucket, setPublishedBucket, selectedAgentId, setSelectedAgentId,
    showWithoutAgent, setShowWithoutAgent, hasApplications, setHasApplications, showArchived, setShowArchived,
    geoFilter, geoHint, applyGeo, clearGeo, statusOptions, agentOptions])

  useEffect(() => {
    registerFilters('vacancies-page', filterGroups)
    return () => unregisterFilters('vacancies-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // ── Bulk actions ──
  const { toggleRow, toggleAll, bulkSetOwner, bulkSetStatus, bulkSetClient, bulkPublish, bulkSetAiAgent, bulkRemoveTag, bulkAddNote, bulkArchive, selectedTags, dialog: bulkConfirmDialog } =
    useVacancyBulkActions({ vacancies, setVacancies, setTotal, selectedIds, setSelectedIds, notify, t, statusMeta: statusMetaSafe })

  // VAC-BULK-AGENT-1: the agent picker's option source (shared cached query with the
  // drawer's AI-agent tab). Only fetched for users who may actually bulk-update —
  // a read-only viewer gets 403 on the bulk route anyway, so don't ask for the list.
  const { options: aiAgentOptions } = useAiAgents(hasPermission('vacancies.update'))
  const aiAgents = aiAgentOptions.map(o => ({ id: o.value, name: o.label }))

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
    applicationsTotal, hasApplications, setHasApplications,
  })
  // Shared clear-all (page memory keeps filters sticky).
  const anyFilterActive = Boolean(globalSearch.trim() || showArchived || showTrash || showWithoutAgent || Boolean(selectedAgentId) || statusBucket !== 'all'
    || selectedOwner.length || selectedClient.length || selectedCategory.length || selectedBranch.length || publishedBucket !== 'all' || hasApplications || attention || geoFilter)
  const [searchEpoch, setSearchEpoch] = useState(0)
  const clearAllFilters = () => {
    setSearchEpoch(e => e + 1); setGlobalSearch(''); setShowArchived(false); setShowTrash(false); setShowWithoutAgent(false); setSelectedAgentId(null); setStatusBucket('all')
    setSelectedOwner([]); setSelectedClient([]); setSelectedCategory([]); setSelectedBranch([]); setPublishedBucket('all'); setHasApplications(false); setAttention(null)
    clearGeo(); setPage(1)
  }

  // Status tab bar: "All" + one button per configured status.

  return (
    <>
      {addOpen && (
        <AddVacancyModal onClose={() => setAddOpen(false)} onCreated={v => { setAddOpen(false); handleCreated(v) }}
          // EXCEL-VACATURES-1: a real file import refetches the list/stats (refresh)
          // instead of prepending the way handleCreated does — a real import can
          // land any number of vacancies in one run (mirrors AddCustomerModal).
          onImported={refresh}
          users={users} customers={customerList} />
      )}
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* KPI block: 7 donuts + 2 KPI cards (VAC-KPI-REDESIGN 22-07 — 9 tiles total).
              V27: the published donut is a real server-wide aggregate, so no more
              STATS-OOM-1 honesty notice here; the agent donut's own honest-gate lives
              in useVacancyInsights.ts (agentData) until VAC-STATS-BYAGENT-1 lands. */}
          <InsightsRow donuts={insightDonuts} kpis={insightKpis} clearTitle={t('insights.clearFilter')}
            // VESTIGING-2: an explicit branch filter EXCLUDES records with no branch
            // linked yet — a resulting empty list must say so, not read as "nothing here".
            notice={selectedBranch.length > 0 && total === 0 ? t('common:filters.branchExcludesUnassigned') : undefined} />

          {/* Toolbar (§0.3 split → VacanciesToolbar, mirrors CandidatesToolbar):
              bulk bar (composed here — its data wiring stays in this container)
              or add/search/clear + the archived/trash/map quick-view toggles. */}
          <VacanciesToolbar
            selectedCount={selectedIds.size}
            bulkBar={
              <VacanciesBulkBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}
                onSetOwner={bulkSetOwner} onSetStatus={bulkSetStatus} onSetClient={bulkSetClient}
                onPublish={() => bulkPublish(true)} onUnpublish={() => bulkPublish(false)}
                onSetAiAgent={bulkSetAiAgent}
                onRemoveTag={bulkRemoveTag} onAddNote={bulkAddNote} onArchive={bulkArchive}
                canArchive={hasPermission('vacancies.delete')}
                users={users} statuses={statuses} customers={customerList} aiAgents={aiAgents} selectedTags={selectedTags}
                selectedVacancies={vacancies.filter((v): v is typeof v & { id: Id } => v.id != null && selectedIds.has(v.id)).map(v => ({ id: v.id, title: v.title }))}
                onOpenCandidateSearch={openCandidateSearch} />
            }
            onAddOpen={() => setAddOpen(true)}
            searchEpoch={searchEpoch} globalSearch={globalSearch} onSearch={setGlobalSearch}
            anyFilterActive={anyFilterActive} onClearFilters={clearAllFilters}
            showArchived={showArchived} onToggleArchived={() => { setShowArchived(v => !v); setShowTrash(false) }}
            showTrash={showTrash} onToggleTrash={() => { setShowTrash(v => !v); setShowArchived(false) }}
            mapActive={view === 'map'} onToggleView={() => setView(x => (x === 'map' ? 'table' : 'map'))}
          />

          {/* Transient feedback for bulk mutations — audit R1 item 5: this was a
              copy-pasted role=status banner (mirrored in Candidates/Customers); now
              the ONE shared component (§3A). */}
          <ActionMessageBanner msg={actionMsg} onDismiss={() => setActionMsg(null)} dismissLabel={t('common:close')} />

          {/* Table ⇄ map — ViewSwitch keeps both mounted (display toggle, not
              unmount) so the table's virtualizer never remeasures 0 on returning
              from the map (§ViewSwitch, mirrors candidates/customers). Map LEFT,
              filtered vacancy table RIGHT when active — one radius search drives
              both panes. Lazy Leaflet load. */}
          <ViewSwitch active={view} views={[
            {
              id: 'table',
              render: () => (
                <>
                  <div ref={tableScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
                    {error && (
                      <ErrorBanner style={{ marginBottom: 12 }}>{error}</ErrorBanner>
                    )}
                    <VacanciesTable
                      rows={visibleRows}
                      loading={loading}
                      selectedId={selected?.id}
                      onSelect={openVacancy}
                      onOpenCandidateSearch={openCandidateSearch}
                      onOpenApplicants={openApplicants}
                      onOpenMatches={openMatches}
                      selectable
                      selectedIds={selectedIds}
                      onToggleRow={toggleRow}
                      onToggleAll={toggleAll}
                      selectionBusy={fetching}
                      stickyHeader
                      scrollParentRef={tableScrollRef}
                      sort={sort as ControlledSort | null}
                      onSortChange={next => setSort(next as VacancySort)}
                    />
                  </div>

                  <PaginationBar page={page} totalPages={lastPage} totalRows={total} pageSize={pageSize}
                    onPageChange={setPage} onPageSizeChange={handlePageSizeChange} pageSizeOptions={pageSizeOptions} />
                </>
              ),
            },
            {
              id: 'map',
              render: () => (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14, padding: '0 24px 16px' }}>
                  <div style={{ flex: '1.1 1 0', minWidth: 400, display: 'flex', flexDirection: 'column' }}>
                    <Suspense fallback={<div style={{ padding: 24, fontSize: 12, color: 'var(--text-muted)' }}>{t('common:map.loading')}</div>}>
                      <VacanciesMapView rows={visibleRows} padded={false} center={mapCenter} radiusKm={mapStraalActive ? mapRadius : 0}
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
                      <VacanciesTable rows={visibleRows} loading={loading} selectedId={selected?.id} onSelect={openVacancy}
                        onOpenCandidateSearch={openCandidateSearch} onOpenApplicants={openApplicants} onOpenMatches={openMatches} />
                    </div>
                    <PaginationBar page={page} totalPages={lastPage} totalRows={total} pageSize={pageSize}
                      onPageChange={setPage} onPageSizeChange={handlePageSizeChange} pageSizeOptions={pageSizeOptions} />
                  </div>
                </div>
              ),
            },
          ]} />
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
          // TRASH-OVERAL-2: shared trash section (mark = vacancies.delete, unmark =
          // vacancies.update; backend re-checks, §7). The patches are pure LOCAL
          // merges — buildVacancyPatch maps none of these keys, so no stray PATCH.
          trash={{
            canMark: hasPermission('vacancies.delete'),
            canUnmark: hasPermission('vacancies.update'),
            users: users.map(u => ({ value: String(u.id), label: u.name })),
            onMarked: id => updateVacancy(id, { archived: true, lifecycle: 'pending_erase', pendingEraseAt: new Date().toISOString() }),
            onUnmarked: id => updateVacancy(id, { lifecycle: 'archived', pendingEraseAt: null }),
          }}
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
