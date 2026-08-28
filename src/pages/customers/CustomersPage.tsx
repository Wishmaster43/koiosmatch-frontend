/**
 * CustomersPage — the customer list surface: thin container composing the
 * insights row, table/map view, bulk-actions bar and the customer drawer,
 * mirroring the candidate page blueprint (§3A). Heavy logic lives in the
 * hooks under ./hooks and ./data.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useRightPanel } from '@/context/RightPanelContext'
import { useAuth } from '@/context/AuthContext'
import { usePublishSelection } from '@/context/SelectionContext'
import { useOpenFromIntent } from '@/context/NavigationContext'
import { useDrawerUrl } from '@/hooks/useDrawerUrl'
import { usePageMemory } from '@/lib/usePageMemory'
import { useListPageSize } from '@/hooks/useListPageSize'
import { isReferenceQuery } from '@/lib/referenceNumber'
import ErrorBanner from '@/components/ui/ErrorBanner'
import ViewSwitch from '@/components/ui/ViewSwitch'
import { useUsers } from '@/lib/queries'
import { useCustomerLookups } from '@/lib/useCustomerLookups'
import { useCustomerPhases } from '@/lib/useCustomerPhases'
import { useBranchOptions } from '@/lib/useBranchOptions'
import { NO_STATUS_KEY } from './data/customerInsights'
import { useSeedLabel } from '@/lib/useSeedLabel'
import { buildCustomerInsightsConfig } from './data/customerInsightsConfig'
import type { CustomerDateRange } from './data/customerFilterGroups'
import InsightsRow from '@/components/insights/InsightsRow'
import PaginationBar from '@/components/ui/PaginationBar'
import ActionMessageBanner from '@/components/ui/ActionMessageBanner'
import CustomersTable from './CustomersTable'
import CustomersToolbar from './CustomersToolbar'
import CustomersMapPane from './CustomersMapPane'
import CustomerDrawer from './CustomerDrawer'
import AddCustomerModal from './AddCustomerModal'
import { useCustomersData, CUSTOMERS_MAX_PER_PAGE } from './hooks/useCustomersData'
import { useCustomerRecord } from './hooks/useCustomerRecord'
import { useCustomerBulkActions } from './hooks/useCustomerBulkActions'
import { useCustomersFilterPanel } from './hooks/useCustomersFilterPanel'
import type { Id } from '@/types/common'
import type { Customer } from '@/types/customer'

interface AppUser { id: Id; name: string; avatar_color?: string }

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

// DASH-FEEDS-V3: dashboard donut click-through (customers by owner / by phase).
interface CustomerIntent {
  owner?: string | number
  phase?: string
  // Cross-entity record link ({ open, tab }) — consumed by useOpenFromIntent.
  open?: string | number
  tab?: string
}

// Thin container: wires the filter/data/bulk hooks and composes the insights row, table/map view and drawer for this page.
export default function CustomersPage({ intent }: { intent?: CustomerIntent } = {}) {
  const { t } = useTranslation(['customers', 'common'])
  // LOOKUP-I18N-1: the seeded status/phase label renders in the user's language;
  // a tenant rename/creation passes through untouched.
  const seedLabel = useSeedLabel()
  const { registerFilters, unregisterFilters } = useRightPanel()
  const auth = useAuth()
  const hasPermission = auth?.hasPermission ?? (() => false)
  const { data: users = [] } = useUsers() as { data?: AppUser[] }
  const { statuses, statusMeta, locationStatuses, departmentStatuses, contactStatuses } = useCustomerLookups()
  // Danny 02-08, translated: "Prospect has no status" — verbatim: "Prospect heeft
  // geen status" — the entry (default) phase, resolved
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
  // TRASH-OVERAL-2: Prullenbak view (lifecycle pending_erase) — same include_archived
  // request, split client-side; mutually exclusive with the archived view (mirrors candidates).
  const [showTrash, setShowTrash] = usePageMemory('cust.trash', false)
  // STRAAL-1: map view + radius-search state (server-side ?lat=&lng=&radius=).
  const [view,      setView]      = usePageMemory<'table' | 'map'>('cust.viewMode', 'table')
  const [mapCenter, setMapCenter] = usePageMemory('cust.mapCenter', { lat: 52.09, lng: 5.12 })
  const [mapRadius, setMapRadius] = usePageMemory('cust.mapRadius', 30)
  // Straal-filter (sidebar): place/postcode geocoded via PDOK → server-side lat/lng/radius.
  const [geoFilter, setGeoFilter] = usePageMemory<{ q: string; km: number; lat: number; lng: number; label: string } | null>('cust.geo', null)
  const [geoHint, setGeoHint] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<Id>>(() => new Set())
  // KOIOS-SELECTIE-CONTEXT-1: mirror the selection into Koios AI's context chip.
  usePublishSelection('customers', selectedIds)
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

  // DASH-FEEDS-V3: dashboard donut click-through (customers by owner / by phase).
  useEffect(() => {
    if (!intent) return
    if (intent.owner != null) setSelectedOwner([String(intent.owner)])
    if (intent.phase)         setSelectedPhase([intent.phase])
  }, [intent, setSelectedOwner, setSelectedPhase])

  // Builds the server-side query params from every active filter dimension; the derived filterKey below drives page reset and refetch.
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
    // TRASH-OVERAL-1b: include_archived=1 returns ONLY soft-deleted rows (archived
    // + pending_erase); the lifecycle filter below splits them per view.
    if (showArchived || showTrash) p.include_archived = 1
    if (dateRange)               p[dateRange.param] = [dateRange.from, dateRange.to]
    // Map view narrows the list server-side to the chosen circle (STRAAL-1);
    // in table view the sidebar's straal-blok drives the same params.
    if (view === 'map') { p.lat = mapCenter.lat; p.lng = mapCenter.lng; p.radius = mapRadius }
    else if (geoFilter) { p.lat = geoFilter.lat; p.lng = geoFilter.lng; p.radius = geoFilter.km }
    return p
  }, [globalSearch, selectedStatus, selectedPhase, selectedOwner, selectedCity, selectedProvince, selectedIndustry, selectedBranch, showArchived, showTrash, dateRange, view, mapCenter, mapRadius, geoFilter])
  const filterKey = JSON.stringify(filterParams)

  useEffect(() => { setPage(1) }, [filterKey, setPage])

  // Transient feedback for bulk mutations, auto-dismissed.
  const notify = (type: string, text: string) => { setActionMsg({ type, text }); if (msgTimer.current) clearTimeout(msgTimer.current); msgTimer.current = setTimeout(() => setActionMsg(null), 4000) }
  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current) }, [])

  // ── Data layer (§3): list/stats · record/drawer · bulk actions ──
  const { customers, setCustomers, loading, error, total, setTotal, lastPage, stats, refresh, rowsEpoch, fetching } =
    useCustomersData({ filterParams, page, pageSize, t })

  // SELECT-RACE-1: rowsEpoch (bumped only when a NEW server result actually
  // lands, see useCustomersData) closes the race where a select-all made
  // against the stale rows during a filter/page fetch survived the swap — the
  // input-triggered clear above fires too early to catch that window on its own.
  useEffect(() => { setSelectedIds(new Set()) }, [filterKey, page, pageSize, rowsEpoch])
  const {
    selected, detail, drawerExpanded, setDrawerExpanded, drawerTab,
    closeDrawer, selectCustomer, updateCustomer, restoreCustomer, handleCreate, addNote, editNote, deleteNote,
    fetchPreviousVersion, restorePreviousVersion,
  } = useCustomerRecord({ setCustomers, setTotal, users, t })
  const { toggleRow, toggleAll, bulkSetOwner, bulkSetStatus, bulkAddTag, bulkRemoveTag, bulkAddNote, bulkArchive, bulkGeocode, bulkCoupleBackoffice, selectedTags, dialog: bulkConfirmDialog } =
    useCustomerBulkActions({ customers, setCustomers, setTotal, selectedIds, setSelectedIds, notify, statusMeta, t })

  // Open a customer drawer when arriving via a cross-entity link (intent). The
  // intent may name a drawer tab (a dashboard "vacatures per klant" bar lands on
  // Vacatures) — forward it, never drop it (DASH-FEEDS-V3).
  useOpenFromIntent(intent, (id, tab) => selectCustomer({ id } as Parameters<typeof selectCustomer>[0], tab))

  // Mirror the open drawer in the URL (?open=<id>): browser back/forward walks
  // through it and a copied link reopens the same customer (NAV-BACK-1;
  // supersedes the old memory-only remember).
  useDrawerUrl({
    selectedId: selected?.id,
    openById: (id) => selectCustomer({ id } as Parameters<typeof selectCustomer>[0]),
    close: closeDrawer, intent,
  })

  // ── Option lists + right-panel filter groups (§0.3 split) ──
  const { statusOptions, ownerOptions } = useCustomersFilterPanel({
    t, registerFilters, unregisterFilters, stats, customers, statuses, customerPhases, entryPhase, entryPhaseValue,
    branchOptions,
    filters: {
      selectedStatus, setSelectedStatus, selectedPhase, setSelectedPhase, selectedOwner, setSelectedOwner,
      selectedCity, setSelectedCity, selectedProvince, setSelectedProvince, selectedIndustry, setSelectedIndustry,
      selectedBranch, setSelectedBranch, showArchived, setShowArchived, dateRange, setDateRange,
      geoFilter, setGeoFilter, geoHint, setGeoHint, setMapCenter, setMapRadius,
    },
  })

  // ── Insights: 2 donuts (status, account manager) + KPI cards ──
  // LOOKUP-I18N-1: the '__none' bucket is the entry PHASE (Prospect); every other
  // bucket is a deployability STATUS — each has its own seed catalogue family.
  // `key` stays the raw value so the click-to-filter axis is untouched.
  const statusData = useMemo(() => statusOptions.map(o => ({
    name: seedLabel(o.value === NO_STATUS_KEY ? 'customerPhases' : 'customerStatuses', { value: o.value === NO_STATUS_KEY ? entryPhaseValue : o.value, label: o.label }),
    value: o.count, key: o.value, color: o.color,
  })), [statusOptions, seedLabel, entryPhaseValue])
  // Same reshape as the status donut above, keyed by owner id/name for the account-manager donut.
  const ownerData  = useMemo(() => ownerOptions.map(o => ({ name: o.label, value: o.count, key: String(o.value) })), [ownerOptions])


  // KPI-card filter (one at a time): rows with ≥1 of the counted thing — or, for
  // "zonder contactpersoon", exactly 0 (Danny: every card must DO something).
  const [kpiFilter, setKpiFilter] = usePageMemory<string | null>('cust.kpi', null)
  const toggleKpi = (k: string) => setKpiFilter(p => (p === k ? null : k))
  // Shared clear-all (page memory keeps filters sticky).
  const anyFilterActive = Boolean(globalSearch.trim() || showArchived || showTrash || kpiFilter || geoFilter || dateRange
    || selectedStatus.length || selectedPhase.length || selectedOwner.length || selectedCity.length || selectedProvince.length || selectedIndustry.length || selectedBranch.length)
  const [searchEpoch, setSearchEpoch] = useState(0)
  // Resets every filter dimension (and bumps the search epoch) back to defaults in one action.
  const clearAllFilters = () => {
    setSearchEpoch(e => e + 1); setGlobalSearch(''); setShowArchived(false); setShowTrash(false); setKpiFilter(null)
    setSelectedStatus([]); setSelectedPhase([]); setSelectedOwner([]); setSelectedCity([]); setSelectedProvince([]); setSelectedIndustry([]); setSelectedBranch([])
    setGeoFilter(null); setGeoHint(null); setDateRange(null); setPage(1)
  }

  // One visible-rows list for BOTH the table and the map pane (STRAAL-1 split view).
  // Three lifecycle views (TRASH-OVERAL-2, mirrors candidates): trash = pending_erase,
  // archived = archived only (so pending rows never double-show), default = active.
  const visibleRows = useMemo(() =>
    customers.filter(c =>
      showTrash ? c.lifecycle === 'pending_erase'
      : showArchived ? c.lifecycle === 'archived'
      : !c.archived,
    ).filter(c => !kpiFilter || KPI_PRED[kpiFilter]?.(c)),
  [customers, showArchived, showTrash, kpiFilter])

  // KPI strip config (2 donuts + 6 cards) — pure builder (§0.3 split, mirrors
  // buildVacancyInsightsConfig; extracted once this page crossed ~400 lines).
  const { donuts: insightDonuts, kpis: insightKpis } = buildCustomerInsightsConfig({
    t, stats, customers, statusData, ownerData, entryPhaseValue,
    selectedStatus, setSelectedStatus, selectedPhase, setSelectedPhase, selectedOwner, setSelectedOwner,
    kpiFilter, toggleKpi,
  })

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

          <CustomersToolbar
            t={t} selectedCount={selectedIds.size} onClearSelection={() => setSelectedIds(new Set())}
            bulk={{
              onSetOwner: bulkSetOwner, onSetStatus: bulkSetStatus, onAddTag: bulkAddTag,
              onRemoveTag: bulkRemoveTag, onAddNote: bulkAddNote, onArchive: bulkArchive,
              onGeocode: bulkGeocode, onCoupleBackoffice: bulkCoupleBackoffice, selectedTags,
            }}
            canArchive={hasPermission('customers.delete')} canGeocode={hasPermission('customers.update')}
            users={users} statuses={statuses} onAdd={() => setAddOpen(true)}
            searchEpoch={searchEpoch} globalSearch={globalSearch} onSearch={setGlobalSearch}
            anyFilterActive={anyFilterActive} onClearAllFilters={clearAllFilters}
            showArchived={showArchived} setShowArchived={setShowArchived}
            showTrash={showTrash} setShowTrash={setShowTrash}
            view={view} setView={setView}
          />

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
                      selectionBusy={fetching}
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
                <CustomersMapPane
                  t={t} rows={visibleRows} loading={loading} error={error} selectedId={selected?.id}
                  onSelect={selectCustomer} statusMeta={statusMeta}
                  mapCenter={mapCenter} mapRadius={mapRadius} setMapCenter={setMapCenter} setMapRadius={setMapRadius}
                  page={page} lastPage={lastPage} total={total} pageSize={pageSize} pageSizeOptions={pageSizeOptions}
                  onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }}
                />
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
          // TRASH-OVERAL-2: restore-to-active (customers.update) + the shared trash
          // section (mark = customers.delete, unmark = customers.update; backend
          // re-checks, §7). The onMarked/onUnmarked patches are pure LOCAL merges —
          // none of these keys are in useCustomerRecord's FIELD_MAP, so no stray PATCH.
          onRestore={hasPermission('customers.update') ? restoreCustomer : undefined}
          trash={{
            canMark: hasPermission('customers.delete'),
            canUnmark: hasPermission('customers.update'),
            users: users.map(u => ({ value: String(u.id), label: u.name })),
            onMarked: id => updateCustomer(id, { archived: true, lifecycle: 'pending_erase', pendingEraseAt: new Date().toISOString() }),
            onUnmarked: id => updateCustomer(id, { lifecycle: 'archived', pendingEraseAt: null }),
          }}
          onAddNote={addNote}
          onEditNote={editNote}
          onDeleteNote={deleteNote}
          onFetchPreviousVersion={fetchPreviousVersion}
          onRestorePreviousNote={restorePreviousVersion}
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
