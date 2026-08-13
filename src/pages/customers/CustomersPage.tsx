import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, Map as MapIcon } from 'lucide-react'
import { useRightPanel } from '@/context/RightPanelContext'
import { useAuth } from '@/context/AuthContext'
import { useOpenFromIntent } from '@/context/NavigationContext'
import { useDrawerUrl } from '@/hooks/useDrawerUrl'
import { usePageMemory } from '@/lib/usePageMemory'
import { useListPageSize } from '@/hooks/useListPageSize'
import { geocodeNL } from '@/lib/geocode'
import { isReferenceQuery } from '@/lib/referenceNumber'
import ErrorBanner from '@/components/ui/ErrorBanner'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import ViewSwitch from '@/components/ui/ViewSwitch'
import { useUsers } from '@/lib/queries'
import { useCustomerLookups } from '@/lib/useCustomerLookups'
import { useCustomerPhases } from '@/lib/useCustomerPhases'
import { useBranchOptions } from '@/lib/useBranchOptions'
import { pickCustomerStatusSegment, buildCustomerStatusOptions } from './data/customerInsights'
import { buildCustomerFilterGroups } from './data/customerFilterGroups'
import type { CustomerDateRange } from './data/customerFilterGroups'
import InsightsRow from '@/components/insights/InsightsRow'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import PaginationBar from '@/components/ui/PaginationBar'
import HeaderSearch from '@/components/ui/HeaderSearch'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import ActionMessageBanner from '@/components/ui/ActionMessageBanner'
import CustomersTable from './CustomersTable'
import CustomersBulkBar from './CustomersBulkBar'
import CustomerDrawer from './CustomerDrawer'
import AddCustomerModal from './AddCustomerModal'
import { useCustomersData, CUSTOMERS_MAX_PER_PAGE } from './hooks/useCustomersData'
import { useCustomerRecord } from './hooks/useCustomerRecord'
import { BTN_H } from '@/config/buttonMetrics'
import { useCustomerBulkActions } from './hooks/useCustomerBulkActions'
import type { Id } from '@/types/common'
import type { Customer } from '@/types/customer'

// STRAAL-1: Leaflet only loads when the map view opens (§9 — lazy heavy deps).
const CustomersMapView = lazy(() => import('./CustomersMapView'))

interface AppUser { id: Id; name: string; avatar_color?: string }
interface Opt { value: Id; label: string; count: number }

// Recharts hands the clicked segment both at top level and under `.payload`.
const pickKey = (d: unknown): string | undefined => {
  const o = d as { key?: string; name?: string; payload?: { key?: string } } | null | undefined
  return o?.key ?? o?.payload?.key ?? o?.name
}
const toggleOneValue = (set: Dispatch<SetStateAction<string[]>>, value: string) => set(p => (p.length === 1 && p[0] === value) ? [] : [value])

// KPI-card filter predicates (pure row checks) — rows with ≥1 of the counted thing,
// or, for "zonder contactpersoon", exactly 0 (Danny: every card must DO something).
const KPI_PRED: Record<string, (c: Customer) => boolean> = {
  locations:   c => c.locationsCount > 0,
  departments: c => c.departmentsCount > 0,
  contacts:    c => c.contactsCount > 0,
  openVac:     c => c.openVacanciesCount > 0,
  active:      c => c.activeMatchesCount > 0,
  noContact:   c => c.contactsCount === 0,
}

export default function CustomersPage({ intent }: { intent?: unknown } = {}) {
  const { t } = useTranslation(['customers', 'common'])
  const { registerFilters, unregisterFilters } = useRightPanel()
  const auth = useAuth()
  const hasPermission = auth?.hasPermission ?? (() => false)
  const { data: users = [] } = useUsers() as { data?: AppUser[] }
  const { statuses, statusMeta, locationStatuses, departmentStatuses, contactStatuses } = useCustomerLookups()
  // Danny 02-08: "Prospect heeft geen status" — the entry (default) phase, resolved
  // via the is_default FLAG (never an array position). Feeds the status donut's
  // '__none' bucket below (mirrors the candidate Lead-segment, PHASE-FILTER-1).
  const { phases: customerPhases } = useCustomerPhases()
  const entryPhase = customerPhases.find(p => p.isDefault)
  const entryPhaseValue = entryPhase?.value
  // VESTIGING-2: the branch values this user may filter on — see useBranchOptions for
  // why an empty scope means unrestricted rather than none.
  const branchOptions = useBranchOptions()

  // ── UI state ──
  const [page,      setPage]      = usePageMemory('cust.page', 1)
  // C-33 resolved (§ audit 2026-08-05): CustomerController caps per_page at 200
  // (measured: 500 → 422 "Klanten laden is mislukt", 200 → OK) — the shared hook
  // seeds from the user's default_per_page, clamps to that real ceiling instead of
  // the hardcoded 50 this used to sit at, and stays sticky across the shell's
  // unmount-on-navigate like every other page-level field here.
  const { pageSize, setPageSize, options: pageSizeOptions } = useListPageSize('cust', CUSTOMERS_MAX_PER_PAGE)
  const [addOpen,   setAddOpen]   = useState(false)
  // Archived (soft-deleted) view toggle — opts the list into ?include_archived=1.
  const [showArchived, setShowArchived] = usePageMemory('cust.archived', false)
  // STRAAL-1: map view + radius-search state (server-side ?lat=&lng=&radius=).
  const [view,      setView]      = usePageMemory<'table' | 'map'>('cust.viewMode', 'table')
  const [mapCenter, setMapCenter] = usePageMemory('cust.mapCenter', { lat: 52.09, lng: 5.12 })
  const [mapRadius, setMapRadius] = usePageMemory('cust.mapRadius', 30)
  // Straal-filter (sidebar): place/postcode geocoded via PDOK → server-side lat/lng/radius.
  const [geoFilter, setGeoFilter] = usePageMemory<{ q: string; km: number; lat: number; lng: number; label: string } | null>('cust.geo', null)
  const [geoHint, setGeoHint] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<Id>>(() => new Set())
  const [actionMsg, setActionMsg] = useState<{ type: string; text: string } | null>(null)
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)

  // ── Filter dimensions (server-side) ──
  const [globalSearch,     setGlobalSearch]     = usePageMemory('cust.search', '')
  const [selectedStatus,   setSelectedStatus]   = usePageMemory<string[]>('cust.status', [])
  // Danny 02-08: the status donut's '__none' (no-status/entry-phase) segment
  // filters THIS axis, never `selectedStatus` (mirrors the candidate Lead-segment
  // click, PHASE-FILTER-1 — same forward-looking param, no confirmed BE filter yet).
  const [selectedPhase,    setSelectedPhase]    = usePageMemory<string[]>('cust.phase', [])
  const [selectedOwner,    setSelectedOwner]    = usePageMemory<string[]>('cust.owner', [])
  const [selectedCity,     setSelectedCity]     = usePageMemory<string[]>('cust.city', [])
  const [selectedProvince, setSelectedProvince] = usePageMemory<string[]>('cust.province', [])
  const [selectedIndustry, setSelectedIndustry] = usePageMemory<string[]>('cust.industry', [])
  // VESTIGING-2: explicit branch filter (narrows within what the user may already
  // see — never a widening; server excludes records with no branch, see the notice below).
  const [selectedBranch, setSelectedBranch] = usePageMemory<string[]>('cust.branch', [])
  // Period (created date range) from a dashboard bar click — mirrors the candidate page.
  const [dateRange, setDateRange] = usePageMemory<CustomerDateRange | null>('cust.dateRange', null)

  const filterParams = useMemo(() => {
    const p: Record<string, unknown> = {}
    // NUMMER-1: a typed reference number (D-4) does an exact server-side `?ref=`
    // lookup instead of the normal free-text search; the server ignores other filters.
    if (globalSearch.trim()) {
      const q = globalSearch.trim()
      if (isReferenceQuery(q)) p.ref = q
      else p.search = q
    }
    if (selectedStatus.length)   p.status   = selectedStatus
    if (selectedPhase.length)    p.phase    = selectedPhase
    if (selectedOwner.length)    p.owner_id = selectedOwner
    if (selectedCity.length)     p.city     = selectedCity
    if (selectedProvince.length) p.state    = selectedProvince
    if (selectedIndustry.length) p.industry = selectedIndustry
    // VESTIGING-2: server-side ?branch_id[]= — a narrowing only, gated behind the
    // tenant's own branch_authz_enabled axis on the backend (off = no effect).
    if (selectedBranch.length)  p.branch_id = selectedBranch
    if (showArchived)            p.include_archived = 1
    if (dateRange)               p[dateRange.param] = [dateRange.from, dateRange.to]
    // Map view narrows the list server-side to the chosen circle (STRAAL-1);
    // in table view the sidebar's straal-blok drives the same params.
    if (view === 'map') { p.lat = mapCenter.lat; p.lng = mapCenter.lng; p.radius = mapRadius }
    else if (geoFilter) { p.lat = geoFilter.lat; p.lng = geoFilter.lng; p.radius = geoFilter.km }
    return p
  }, [globalSearch, selectedStatus, selectedPhase, selectedOwner, selectedCity, selectedProvince, selectedIndustry, selectedBranch, showArchived, dateRange, view, mapCenter, mapRadius, geoFilter])
  const filterKey = JSON.stringify(filterParams)

  useEffect(() => { setPage(1) }, [filterKey])
  useEffect(() => { setSelectedIds(new Set()) }, [filterKey, page, pageSize])

  // Transient feedback for bulk mutations, auto-dismissed.
  const notify = (type: string, text: string) => { setActionMsg({ type, text }); if (msgTimer.current) clearTimeout(msgTimer.current); msgTimer.current = setTimeout(() => setActionMsg(null), 4000) }
  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current) }, [])

  // ── Data layer (§3): list/stats · record/drawer · bulk actions ──
  const { customers, setCustomers, loading, error, total, setTotal, lastPage, stats, refresh } =
    useCustomersData({ filterParams, page, pageSize, t })
  const {
    selected, detail, drawerExpanded, setDrawerExpanded, drawerTab,
    closeDrawer, selectCustomer, updateCustomer, handleCreate, addNote, editNote, deleteNote,
  } = useCustomerRecord({ setCustomers, setTotal, users, t })
  const { toggleRow, toggleAll, bulkSetOwner, bulkSetStatus, bulkAddTag, bulkRemoveTag, bulkAddNote, bulkArchive, bulkGeocode, bulkCoupleBackoffice, selectedTags, dialog: bulkConfirmDialog } =
    useCustomerBulkActions({ customers, setCustomers, setTotal, selectedIds, setSelectedIds, notify, statusMeta, t })

  // Open a customer drawer when arriving via a cross-entity link (intent).
  useOpenFromIntent(intent, (id) => selectCustomer({ id } as Parameters<typeof selectCustomer>[0]))

  // Mirror the open drawer in the URL (?open=<id>): browser back/forward walks
  // through it and a copied link reopens the same customer (NAV-BACK-1;
  // supersedes the old memory-only remember).
  useDrawerUrl({
    selectedId: selected?.id,
    openById: (id) => selectCustomer({ id } as Parameters<typeof selectCustomer>[0]),
    close: closeDrawer, intent,
  })

  // ── Option lists (stats first, page-derived as fallback) ──
  const optsFrom = (values: string[]): Opt[] => {
    const counts: Record<string, number> = {}
    values.forEach(v => { counts[v] = (counts[v] ?? 0) + 1 })
    return Object.keys(counts).map(v => ({ value: v, label: v, count: counts[v] }))
  }
  // Danny 02-08: the status donut must stop counting Prospect as a status — the
  // '__none' bucket (buildCustomerStatusOptions, mirrors the candidate Lead
  // bucket) keys on the PHASE, never the (retiring) customer_statuses 'prospect'
  // value, so nothing here needs to change once the backend finishes removing it.
  const statusOptions = useMemo(() =>
    buildCustomerStatusOptions({
      statsByStatus: stats?.by_status, customers, statuses, entryPhase, entryPhaseValue,
      noStatusFallbackLabel: t('insights.noStatus'),
    })
  , [stats, customers, statuses, entryPhase, entryPhaseValue, t])
  const ownerOptions = useMemo<Opt[]>(() => {
    if (stats?.by_owner) return stats.by_owner.map(o => ({ value: (o.id ?? o.owner_id ?? '') as Id, label: o.name || '—', count: o.count ?? 0 })).filter(o => o.value !== '')
    const m: Record<string, Opt> = {}
    customers.forEach(c => { if (c.ownerId != null) { const key = String(c.ownerId); (m[key] ??= { value: c.ownerId as Id, label: c.owner || '—', count: 0 }).count++ } })
    return Object.values(m)
  }, [stats, customers])
  const cityOptions     = useMemo(() => optsFrom(customers.map(c => c.city).filter(Boolean)), [customers])
  const provinceOptions = useMemo(() => optsFrom(customers.map(c => c.state).filter(Boolean)), [customers])
  const industryOptions = useMemo(() => optsFrom(customers.map(c => c.industry).filter(Boolean)), [customers])
  const phaseOptions = useMemo<Opt[]>(() => customerPhases.map(p => ({ value: p.value, label: p.label, count: 0, color: p.color })), [customerPhases])

  const tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])
  const pickOne = (set: Dispatch<SetStateAction<string[]>>) => (v: string | undefined) => { if (v != null) toggleOneValue(set, v) }

  // Straal-blok apply: PDOK-geocode; found → filter + map sync, not found → hint.
  const applyGeo = async (q: string, km: number) => {
    setGeoHint(null)
    const hit = await geocodeNL(q)
    if (!hit) { setGeoHint(t('common:filters.notFound')); return }
    setGeoFilter({ q, km, lat: hit.lat, lng: hit.lng, label: `${hit.label} · ${km} km` })
    setMapCenter({ lat: hit.lat, lng: hit.lng }); setMapRadius(km)
  }

  // Filter panel config lives in the data/ builder (mirrors buildCandidateFilterGroups).
  const filterGroups = useMemo(() => buildCustomerFilterGroups({
    t, tog,
    filters: {
      selectedStatus, setSelectedStatus, selectedPhase, setSelectedPhase,
      selectedIndustry, setSelectedIndustry, selectedCity, setSelectedCity,
      selectedProvince, setSelectedProvince, selectedOwner, setSelectedOwner,
      selectedBranch, setSelectedBranch, showArchived, setShowArchived,
      dateRange, setDateRange, geoFilter, geoHint, applyGeo,
      clearGeo: () => { setGeoFilter(null); setGeoHint(null) },
    },
    options: { statusOptions, phaseOptions, industryOptions, cityOptions, provinceOptions, ownerOptions, branchOptions },
  }), [t, selectedStatus, selectedPhase, selectedIndustry, selectedCity, selectedProvince, selectedOwner, selectedBranch,
      showArchived, dateRange, geoFilter, geoHint, statusOptions, phaseOptions, industryOptions, cityOptions, provinceOptions, ownerOptions, branchOptions]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    registerFilters('customers-page', filterGroups)
    return () => unregisterFilters('customers-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // ── Insights: 2 donuts (status, account manager) + KPI cards ──
  const statusData = useMemo(() => statusOptions.map(o => ({ name: o.label, value: o.count, key: o.value, color: o.color })), [statusOptions])
  const ownerData  = useMemo(() => ownerOptions.map(o => ({ name: o.label, value: o.count, key: String(o.value) })), [ownerOptions])


  // KPI-card filter (one at a time): rows with ≥1 of the counted thing — or, for
  // "zonder contactpersoon", exactly 0 (Danny: every card must DO something).
  const [kpiFilter, setKpiFilter] = usePageMemory<string | null>('cust.kpi', null)
  const toggleKpi = (k: string) => setKpiFilter(p => (p === k ? null : k))
  // Shared clear-all (page memory keeps filters sticky).
  const anyFilterActive = Boolean(globalSearch.trim() || showArchived || kpiFilter || geoFilter || dateRange
    || selectedStatus.length || selectedPhase.length || selectedOwner.length || selectedCity.length || selectedProvince.length || selectedIndustry.length || selectedBranch.length)
  const [searchEpoch, setSearchEpoch] = useState(0)
  const clearAllFilters = () => {
    setSearchEpoch(e => e + 1); setGlobalSearch(''); setShowArchived(false); setKpiFilter(null)
    setSelectedStatus([]); setSelectedPhase([]); setSelectedOwner([]); setSelectedCity([]); setSelectedProvince([]); setSelectedIndustry([]); setSelectedBranch([])
    setGeoFilter(null); setGeoHint(null); setDateRange(null); setPage(1)
  }

  // One visible-rows list for BOTH the table and the map pane (STRAAL-1 split view):
  // archived quick-view + the client-side KPI refine narrow whatever the server returned.
  const visibleRows = useMemo(() =>
    customers.filter(c => (showArchived ? c.archived : !c.archived)).filter(c => !kpiFilter || KPI_PRED[kpiFilter]?.(c)),
  [customers, showArchived, kpiFilter])

  const totalLocations   = stats?.locations   ?? customers.reduce((s, c) => s + c.locationsCount, 0)
  const totalDepartments = stats?.departments ?? customers.reduce((s, c) => s + c.departmentsCount, 0)
  const totalContacts    = stats?.contacts    ?? customers.reduce((s, c) => s + c.contactsCount, 0)
  const totalOpenVac     = stats?.open_vacancies ?? customers.reduce((s, c) => s + c.openVacanciesCount, 0)
  const totalActive      = stats?.active_matches ?? customers.reduce((s, c) => s + c.activeMatchesCount, 0)
  const noContactCount   = stats?.without_contact ?? customers.filter(c => c.contactsCount === 0).length

  const insightDonuts: DonutSpec[] = [
    // Danny 02-08: the '__none' segment is the entry-phase (Prospect) bucket — its
    // click filters the PHASE axis, never the status axis (mirrors the candidate
    // Lead-segment click, PHASE-FILTER-1).
    { key: 'status', title: t('insights.statusTitle'), data: statusData,
      onPick: d => {
        const { axis, value } = pickCustomerStatusSegment(pickKey(d), entryPhaseValue)
        if (axis === 'phase') pickOne(setSelectedPhase)(value)
        else pickOne(setSelectedStatus)(value)
      },
      active: selectedStatus.length > 0 || selectedPhase.length > 0,
      onClear: () => { setSelectedStatus([]); setSelectedPhase([]) } },
    { key: 'am', title: t('insights.amTitle'), data: ownerData, onPick: d => pickOne(setSelectedOwner)(pickKey(d)),
      active: selectedOwner.length > 0, onClear: () => setSelectedOwner([]) },
  ]
  const kpiCard = (key: string, label: string, value: number, sub: string, color: string): KpiSpec =>
    ({ key, label, value, sub, color, onClick: () => toggleKpi(key), active: kpiFilter === key })
  const insightKpis: KpiSpec[] = [
    kpiCard('locations',   t('insights.locations'),     totalLocations,   t('insights.locationsSub'),     'var(--color-secondary)'),
    kpiCard('departments', t('insights.departments'),   totalDepartments, t('insights.departmentsSub'),   'var(--color-violet)'),
    // Use the readable primary-text token, not the raw primary, so a light brand colour (e.g. AENF yellow) stays legible
    kpiCard('contacts',    t('insights.contacts'),      totalContacts,    t('insights.contactsSub'),      'var(--color-primary-text)'),
    kpiCard('openVac',     t('insights.openVacancies'), totalOpenVac,     t('insights.openVacanciesSub'), 'var(--color-warning)'),
    kpiCard('active',      t('insights.activeMatches'), totalActive,      t('insights.activeMatchesSub'), 'var(--color-success)'),
    kpiCard('noContact',   t('insights.noContact'),     noContactCount,   t('insights.noContactSub'),     'var(--color-danger)'),
  ]

  return (
    <>
      {/* The modal now awaits handleCreate itself and only closes on success (C-18) —
          it used to close immediately here, hiding a failed create entirely.
          CUSTOMER-IMPORT-1: onImported refetches the list/stats after the modal's own
          file-import card writes records directly — there is no single optimistic row
          to prepend the way handleCreate does, so a real refetch is the honest option. */}
      {addOpen && <AddCustomerModal onClose={() => setAddOpen(false)} onCreate={handleCreate} onImported={refresh} users={users} statuses={statuses} />}
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          <InsightsRow donuts={insightDonuts} kpis={insightKpis} clearTitle={t('insights.clearFilter')}
            // VESTIGING-2: an explicit branch filter EXCLUDES records with no branch
            // linked yet — a resulting empty list must say so, not read as "nothing here".
            notice={selectedBranch.length > 0 && total === 0 ? t('common:filters.branchExcludesUnassigned') : undefined} />

          {/* Shared banner (§0.3 split, audit R1 item 1) — was copy-pasted per page. */}
          <ActionMessageBanner msg={actionMsg} onDismiss={() => setActionMsg(null)} dismissLabel={t('common:close')} />

          <div style={{ padding: '0 24px 12px', display: 'flex', gap: 10, alignItems: 'center', minHeight: 36, flexShrink: 0 }}>
            {selectedIds.size > 0 ? (
              <CustomersBulkBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}
                onSetOwner={bulkSetOwner} onSetStatus={bulkSetStatus} onAddTag={bulkAddTag}
                onRemoveTag={bulkRemoveTag} onAddNote={bulkAddNote} onArchive={bulkArchive}
                canArchive={hasPermission('customers.delete')}
                onGeocode={bulkGeocode} canGeocode={hasPermission('customers.update')}
                onCoupleBackoffice={bulkCoupleBackoffice}
                users={users} statuses={statuses} selectedTags={selectedTags} />
            ) : (
              <>
                {/* Add on the left (like Applications/Candidates) — BTN_H (§4/§9): one
                    explicit height for every text/action button, everywhere. */}
                <button onClick={() => setAddOpen(true)} style={{ display: 'flex', alignItems: 'center', height: BTN_H, padding: '0 14px', fontSize: 13, fontWeight: 600,
                  background: 'var(--color-primary)', color: 'var(--color-on-accent)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                  + {t('page.add')}
                </button>
                {/* Shared header search (T10) — debounced, drives the same server-side ?search=. */}
                <HeaderSearch key={searchEpoch} onSearch={setGlobalSearch} defaultValue={globalSearch}
                  placeholder={t('page.searchPlaceholder')} width={300} />
                <ClearFiltersButton active={anyFilterActive} onClear={clearAllFilters} />
                {/* Archived + map quick-views on the right — shared toggles (§4), map last
                    to mirror the candidate blueprint's toggle order (§3A). */}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <QuickViewToggle active={showArchived} onToggle={() => setShowArchived(v => !v)}
                    label={t('page.archivedView')} color="var(--color-archive)" icon={Archive} />
                  <QuickViewToggle active={view === 'map'} onToggle={() => setView(v => (v === 'map' ? 'table' : 'map'))}
                    label={t('common:map.view')} color="var(--color-map)" icon={MapIcon} />
                </div>
              </>
            )}
          </div>

          {/* Table ⇄ map — ViewSwitch keeps both mounted (display toggle, not unmount)
              so the table's virtualizer never remeasures 0 on returning from the map
              (§ViewSwitch, mirrors candidates). Map LEFT, filtered customer table
              RIGHT when active — one radius search drives both panes. Lazy Leaflet load. */}
          <ViewSwitch active={view} views={[
            {
              id: 'table',
              render: () => (
                <>
                  <div ref={tableScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
                    {error && (
                      <ErrorBanner style={{ marginBottom: 12 }}>{error}</ErrorBanner>
                    )}
                    <CustomersTable rows={visibleRows} loading={loading} selectedId={selected?.id} onSelect={selectCustomer}
                      onOpenTab={selectCustomer}
                      statusMeta={statusMeta} selectable selectedIds={selectedIds} onToggleRow={toggleRow} onToggleAll={toggleAll}
                      stickyHeader scrollParentRef={tableScrollRef} />
                  </div>

                  <PaginationBar page={page} totalPages={lastPage} totalRows={total} pageSize={pageSize}
                    onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} pageSizeOptions={pageSizeOptions} />
                </>
              ),
            },
            {
              id: 'map',
              render: () => (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14, padding: '0 24px 16px' }}>
                  <div style={{ flex: '1.1 1 0', minWidth: 400, display: 'flex', flexDirection: 'column' }}>
                    <Suspense fallback={<div style={{ padding: 24, fontSize: 12, color: 'var(--text-muted)' }}>{t('common:map.loading')}</div>}>
                      <CustomersMapView rows={visibleRows} padded={false}
                        statusColor={v => statusMeta(String(v)).color} center={mapCenter} radiusKm={mapRadius}
                        onCenterChange={(lat, lng) => setMapCenter({ lat, lng })} onRadiusChange={setMapRadius}
                        onPick={id => selectCustomer({ id } as Parameters<typeof selectCustomer>[0])} />
                    </Suspense>
                  </div>
                  {/* Right pane: the same server-filtered rows as a table (row click = drawer). */}
                  <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                      {error && (
                        <ErrorBanner style={{ marginBottom: 12 }}>{error}</ErrorBanner>
                      )}
                      <CustomersTable rows={visibleRows} loading={loading} selectedId={selected?.id}
                        onSelect={selectCustomer} onOpenTab={selectCustomer} statusMeta={statusMeta} />
                    </div>
                    <PaginationBar page={page} totalPages={lastPage} totalRows={total} pageSize={pageSize}
                      onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} pageSizeOptions={pageSizeOptions} />
                  </div>
                </div>
              ),
            },
          ]} />
        </div>

        <CustomerDrawer
          key={selected ? `${selected.id}-${detail ? 'full' : 'lite'}` : 'none'}
          customer={detail ?? selected}
          onClose={closeDrawer}
          expanded={drawerExpanded}
          onToggleExpand={() => setDrawerExpanded(v => !v)}
          onUpdate={updateCustomer}
          onAddNote={addNote}
          onEditNote={editNote}
          onDeleteNote={deleteNote}
          users={users}
          statuses={statuses}
          locationStatuses={locationStatuses}
          departmentStatuses={departmentStatuses}
          contactStatuses={contactStatuses}
          initialTab={drawerTab}
        />
        {bulkConfirmDialog}
      </div>
    </>
  )
}
