/**
 * CandidatesPage — the candidate list surface (blueprint for every entity).
 * Thin container: owns the UI state (filters, selection, drawer) and composes the
 * data hook (list/stats/locations), the options hook (filter options + donuts +
 * counts) and the bulk-actions hook, then renders the insights row + table +
 * drawer. Heavy logic lives in the hooks under ./hooks and ./data.
 */
import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react'
import type { ComponentType, Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertTriangle, X, Ban, Archive, Trash2, Map as MapIcon } from 'lucide-react'
import { useRightPanel } from '@/context/RightPanelContext'
import { useAuth } from '@/context/AuthContext'
import { useLookups } from '@/context/LookupsContext'
import { useGenders } from '@/lib/useGenders'
import { useUsers } from '@/lib/queries'
import CandidateDrawerJs from './CandidateDrawer'
import CandidateLifecycleModals from './CandidateLifecycleModals'
import AddCandidateModal from './AddCandidateModal'
import CandidatesTable from './CandidatesTable'
import CandidatesBulkBar from './CandidatesBulkBar'
import InsightsRowJs from '@/components/insights/InsightsRow'
import PaginationBar from '@/components/ui/PaginationBar'
import HeaderSearch from '@/components/ui/HeaderSearch'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import { toggleOneValue, isStale, isNeverContacted, optsFrom } from './data/candidatesShared'
import { usePools } from '@/lib/usePools'
import { usePageMemory } from '@/lib/usePageMemory'
import { useAllSettings, getNumberSetting } from '@/lib/settings/useAllSettings'
import { useCandidateFilters } from './hooks/useCandidateFilters'
import { buildCandidateFilterGroups } from './data/candidateFilterGroups'
import { useCandidatesData } from './hooks/useCandidatesData'
import { useCandidateOptions } from './hooks/useCandidateOptions'
import { useCandidateBulkActions } from './hooks/useCandidateBulkActions'
import { useCandidateDrawerActions } from './hooks/useCandidateDrawerActions'
import { buildCandidateInsights } from './data/candidateInsights'
import { useOpenFromIntent } from '@/context/NavigationContext'
import { useDrawerUrl } from '@/hooks/useDrawerUrl'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

interface CandidateIntent {
  attention?: string
  status?: string
  owner?: string | number
  funnel?: string
  location?: string | number
  created_between?: [string, string]
  last_contact_between?: [string, string]
}
interface ActionMsg { type: string; text: string; action?: { label: string; onClick: () => void } }
interface AppUser { id: Id; name: string; [k: string]: unknown }

// Still-untyped JS components — declare the props this page passes (typed boundary).
const CandidateDrawer = CandidateDrawerJs as ComponentType<{
  candidate: Candidate | null; onClose: () => void; expanded: boolean
  onToggleExpand: () => void; onUpdate: (id: Id, patch: Record<string, unknown>) => void
  onArchive?: (id: Id) => void; onMarkDeletion?: (id: Id) => void; onRestore?: (id: Id) => void; onHardDelete?: (id: Id) => void
  users: AppUser[]; initialTab?: string
}>
const InsightsRow = InsightsRowJs as ComponentType<{ donuts?: unknown[]; kpis?: unknown[]; clearTitle?: string }>
// STRAAL-1: the map view lazy-loads so Leaflet stays out of the main bundle (§9).
const CandidatesMapView = lazy(() => import('./CandidatesMapView'))

export default function CandidatesPage({ intent }: { intent?: CandidateIntent } = {}) {
  // Auth/user must come first — pageSize initial value reads user.default_per_page.
  const { hasPermission, user } = useAuth() as unknown as { hasPermission: (p: string) => boolean; user: { default_per_page?: number } | null }
  const { t } = useTranslation(['candidates', 'common'])
  const { candidateTypes, funnelTypes, statuses, phases } = useLookups()
  const { genders } = useGenders()
  const { data: users = [] } = useUsers() as { data?: AppUser[] }
  const { registerFilters, unregisterFilters } = useRightPanel() as { registerFilters: (id: string, groups: unknown) => void; unregisterFilters: (id: string) => void }

  const [page,           setPage]           = usePageMemory('cand.page', 1)
  // Initialise from the user's profile preference (Profile → Records per page).
  const [pageSize,       setPageSize]       = useState<number>(() => user?.default_per_page ?? 50)
  const [addOpen,        setAddOpen]        = useState(false)
  // STRAAL-1: table ⇄ map view; the map searches server-side within centre+radius.
  const [view,           setView]           = usePageMemory<'table' | 'map'>('cand.viewMode', 'table')
  const [mapCenter,      setMapCenter]      = usePageMemory('cand.mapCenter', { lat: 52.09, lng: 5.12 })
  const [mapRadius,      setMapRadius]      = usePageMemory('cand.mapRadius', 30)

  // Bulk-selectie (checkboxes) — id-set; gewist bij filter/pagina-wissel.
  const [selectedIds,      setSelectedIds]      = useState<Set<Id>>(() => new Set())
  // Transient feedback for bulk mutations (success/error), auto-dismissed.
  const [actionMsg,        setActionMsg]        = useState<ActionMsg | null>(null)
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 14-day window for the "actieve gesprekken" card filter — captured once (pure render).
  const [convCutoff] = useState(() => Date.now() - 14 * 86400000)
  // "Not contacted > N months" threshold — tenant setting (Settings → KPI's → Candidates), default 6.
  const settings = useAllSettings()
  const staleMonths = getNumberSetting(settings, 'no_contact_alert_months', 6)

  // ALL filter state + derived filterParams live in one hook (§0.3 size split).
  const {
    showArchived, setShowArchived, showTrash, setShowTrash,
    selectedStatus, setSelectedStatus, selectedPhase, setSelectedPhase, selectedFunnel, setSelectedFunnel,
    selectedType, setSelectedType, selectedOwner, setSelectedOwner,
    selectedGeslacht, setSelectedGeslacht, selectedProvince, setSelectedProvince,
    selectedTitle, setSelectedTitle, selectedLocation, setSelectedLocation,
    selectedPool, setSelectedPool, selectedCity, setSelectedCity,
    selectedSource, setSelectedSource,
    globalSearch, setGlobalSearch, attentionFilter, setAttentionFilter,
    dateRange, setDateRange, geoFilter, geoHint, applyGeo, clearGeo,
    anyFilterActive, clearAllFilters, searchEpoch, filterParams, filterKey,
  } = useCandidateFilters({ t, staleMonths, view, mapCenter, mapRadius, setMapCenter, setMapRadius })

  // Seed filters from a navigation intent (e.g. a dashboard KPI/chart click).
  useEffect(() => {
    if (!intent) return
    if (intent.attention)     setAttentionFilter(intent.attention)
    if (intent.status)        setSelectedStatus([intent.status])
    if (intent.owner != null) setSelectedOwner([intent.owner])
    if (intent.funnel)        setSelectedFunnel([intent.funnel])
    if (intent.location)      setSelectedLocation([intent.location])
    if (intent.created_between)           setDateRange({ param: 'created_between', from: intent.created_between[0], to: intent.created_between[1] })
    else if (intent.last_contact_between) setDateRange({ param: 'last_contact_between', from: intent.last_contact_between[0], to: intent.last_contact_between[1] })
  }, [intent])

  const handlePageSizeChange = (newSize: number) => { setPageSize(newSize); setPage(1) }

  // Filters changed → back to page 1. Visible rows change → drop the bulk selection.
  useEffect(() => { setPage(1) }, [filterKey])
  useEffect(() => { setSelectedIds(new Set()) }, [filterKey, page, pageSize])

  // Show a transient success/error message; replaces any previous one.
  const notify = (type: string, text: string) => {
    setActionMsg({ type, text })
    if (msgTimer.current) clearTimeout(msgTimer.current)
    msgTimer.current = setTimeout(() => setActionMsg(null), 4000)
  }
  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current) }, [])

  // ── Data layer ──
  const { candidates, setCandidates, loading, error, total, setTotal, lastPage, stats, locations } =
    useCandidatesData({ filterParams, page, pageSize, t, setActionMsg })

  // ── Derived options + donut data + attention counts ──
  const {
    statusOptions, funnelOptions, typeOptions, ownerOptions,
    genderOptions, provinceOptions, titleOptions, locationOptions,
    statusData, funnelData, rcData,
    staleCount, neverContactedCount, noFollowupCount, intakeCount, activeConvCount, tasksCount,
  } = useCandidateOptions({ stats, candidates, locations, statuses, funnelTypes, candidateTypes, genders, phases })

  // CAND-FILTERS option lists: pools (ids from the lookup), city/source (page-derived).
  const { poolItems } = usePools()
  const poolOptions   = useMemo(() => poolItems.map(p => ({ value: p.id, label: p.name })), [poolItems])
  // Fase-filter options (lifecycle axis) — straight from the tenant phases lookup.
  const phaseOptions  = useMemo(() => phases.map(ph => ({ value: ph.value, label: ph.label, color: ph.color })), [phases])
  const cityOptions   = useMemo(() => optsFrom(candidates.map(c => c.city).filter(Boolean) as string[]), [candidates])
  const sourceOptions = useMemo(() => optsFrom(candidates.map(c => (c as { source?: string | null }).source ?? '').filter(Boolean)), [candidates])


  const tog = <T,>(set: Dispatch<SetStateAction<T[]>>) => (v: T) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])
  // Klik-op-chart → zet precies één waarde, of wis bij nogmaals klikken (toggle).
  const pickOne = <T,>(set: Dispatch<SetStateAction<T[]>>) => (v: T | null | undefined) => { if (v != null) toggleOneValue(set, v) }
  const pickStatus = pickOne(setSelectedStatus)
  const pickPhase  = pickOne(setSelectedPhase)
  const pickFunnel = pickOne(setSelectedFunnel)
  const pickOwner  = pickOne(setSelectedOwner)
  const toggleAttention = (key: string) => setAttentionFilter(prev => prev === key ? null : key)
  // Blacklist quick-view: the blacklist status is flag-driven (§3B: is_blacklist), never a
  // hardcoded value key. Set/clear the status filter to just that value.
  const blacklistValue = statuses.find(s => s.is_blacklist)?.value ?? 'blacklist'
  const blacklistActive = selectedStatus.length === 1 && selectedStatus[0] === blacklistValue
  const toggleBlacklist = () => setSelectedStatus(blacklistActive ? [] : [blacklistValue])

  // Panel groups are config built by a pure helper (§0.3 size split) — the memo
  // only re-runs when a selection or option list actually changes.
  const filterGroups = useMemo(() => buildCandidateFilterGroups({
    t, tog, filters: {
      selectedStatus, setSelectedStatus, selectedPhase, setSelectedPhase, selectedFunnel, setSelectedFunnel,
      selectedType, setSelectedType, selectedTitle, setSelectedTitle,
      selectedPool, setSelectedPool, selectedCity, setSelectedCity,
      selectedProvince, setSelectedProvince, selectedGeslacht, setSelectedGeslacht,
      selectedOwner, setSelectedOwner, selectedLocation, setSelectedLocation,
      selectedSource, setSelectedSource,
      showArchived, setShowArchived, dateRange, setDateRange,
      geoFilter, geoHint, applyGeo, clearGeo,
    },
    options: { statusOptions, phaseOptions, funnelOptions, typeOptions, titleOptions, poolOptions, cityOptions,
      provinceOptions, genderOptions, ownerOptions, locationOptions, sourceOptions },
  }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [t, showArchived, dateRange, geoFilter, geoHint,
   selectedStatus, selectedPhase, selectedFunnel, selectedType, selectedTitle, selectedGeslacht, selectedProvince, selectedOwner, selectedLocation,
   selectedPool, selectedCity, selectedSource, poolOptions, cityOptions, sourceOptions,
   statusOptions, phaseOptions, funnelOptions, typeOptions, titleOptions, genderOptions, provinceOptions, ownerOptions, locationOptions])

  useEffect(() => {
    registerFilters('candidates-page', filterGroups)
    return () => unregisterFilters('candidates-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // The only client-side refinement left is the attention tile (no server filter yet).
  const filtered = useMemo(() => {
    // Three lifecycle views (ERASE-1): trash = pending_erase, archived = archived,
    // default = active. include_archived returns archived + trash together, so split here.
    const base = candidates.filter(c =>
      showTrash    ? c.lifecycle === 'pending_erase'
      : showArchived ? c.lifecycle === 'archived'
      : !c.archived)
    // stale/never keep a page-local refine (correct predicates); no-follow-up has no correct client
    // predicate → it's server-side only (the no_followup param), so don't page-filter it here.
    if (attentionFilter === 'stale6m')        return base.filter(c => isStale(c, staleMonths))
    if (attentionFilter === 'neverContacted') return base.filter(isNeverContacted)
    if (attentionFilter === 'activeConv')     return base.filter(c => c.lastContactAt && new Date(c.lastContactAt).getTime() > convCutoff)
    return base
  }, [candidates, attentionFilter, showArchived, showTrash, staleMonths])

  // Drawer open/close + single-record lifecycle mutations (§0.3 split → hook).
  const {
    selected, setSelected, detail, setDetail, drawerExpanded, setDrawerExpanded, drawerTab,
    selectCandidate, closeDrawer, patchCandidate,
    archiveOne, restoreOne, markDeletionOne,
    archiveGuard, setArchiveGuard, resolveArchiveGuard,
    eraseTarget, setEraseTarget, hardDeleteOne, confirmHardDelete,
  } = useCandidateDrawerActions({ candidates, setCandidates, setTotal,
    notifyMsg: m => setActionMsg(m as ActionMsg), t })
  // Open a candidate drawer when arriving via a dashboard/cross-entity link ({ open: id }).
  useOpenFromIntent(intent, (id) => selectCandidate({ id } as Candidate))

  // Mirror the open drawer in the URL (?open=<id>): browser back/forward walks
  // through it and a copied link reopens the same candidate (NAV-BACK-1 — Danny
  // 2026-07-06: "opent ook niet vorige items"; supersedes the old memory-only remember).
  useDrawerUrl({ selectedId: selected?.id, openById: (id) => selectCandidate({ id } as Candidate), close: closeDrawer, intent })

  // A freshly created candidate: prepend to the list and open its drawer.
  const handleCreated = (c: Candidate) => {
    setCandidates(prev => [c, ...prev])
    setTotal(prev => prev + 1)
    setAddOpen(false)
    selectCandidate(c)
  }

  // Header/profile edits in the drawer flow back here: optimistic locally, then PATCH.
  // `patch` is a dynamic UI edit (UI field names, some outside Candidate) → cast on merge.
  const updateCandidate = (id: Id, patch: Record<string, unknown>) => {
    setCandidates(prev => prev.map(x => x.id === id ? { ...x, ...patch } as Candidate : x))
    setSelected(prev => (prev && prev.id === id ? { ...prev, ...patch } as Candidate : prev))
    setDetail(prev  => (prev && prev.id === id ? { ...prev, ...patch } as Candidate : prev))
    patchCandidate(id, patch)
  }

  // ── Bulk actions ──
  const {
    toggleRow, toggleAll, bulkAddToPool, bulkRemoveFromPool,
    bulkSetOwner, bulkSetStage, bulkSetTypes, bulkSetConsent, bulkConvertPhase, bulkSetStatus, bulkAddTag,
    selectedTags, bulkRemoveTag, bulkAddNote, bulkArchive,
    bulkArchiveGuard, setBulkArchiveGuard, resolveBulkArchiveGuard,
  } = useCandidateBulkActions({ candidates, setCandidates, setTotal, selectedIds, setSelectedIds, notify, t, funnelTypes, candidateTypes })

  // KPI strip config (3 donuts + attention cards) — pure builder (§0.3 split).
  const { donuts: insightDonuts, kpis: insightKpis } = buildCandidateInsights({
    t, statusData, funnelData, rcData, pickStatus, pickFunnel, pickOwner,
    pickPhase, entryPhase: phases[0]?.value ?? 'lead',
    selectedStatus, setSelectedStatus, selectedPhase, setSelectedPhase, selectedFunnel, setSelectedFunnel,
    selectedOwner, setSelectedOwner, attentionFilter, toggleAttention, staleMonths,
    counts: { stale: staleCount, neverContacted: neverContactedCount, noFollowup: noFollowupCount,
      intake: intakeCount, activeConv: activeConvCount, tasks: tasksCount },
  })

  return (
    <>
      {addOpen && <AddCandidateModal onClose={() => setAddOpen(false)} onCreated={handleCreated} />}
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

        {/* Table area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          <InsightsRow donuts={insightDonuts} kpis={insightKpis}
            clearTitle={t('analytics.clearFilter', { defaultValue: 'Filter wissen' })} />

          {/* Transient feedback for bulk mutations (aria-live for screen readers) */}
          {actionMsg && (
            <div role="status" aria-live="polite" style={{ margin: '0 24px 10px', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 8, fontSize: 12.5,
              background: actionMsg.type === 'error' ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
              color: actionMsg.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)',
              border: `1px solid ${actionMsg.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)'}` }}>
              {actionMsg.type === 'error' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
              {/* Whole text is a click target when an action exists (Danny 13/7). */}
              <span style={{ flex: 1, cursor: actionMsg.action ? 'pointer' : 'default', textDecoration: actionMsg.action ? 'underline' : 'none' }}
                onClick={actionMsg.action ? () => { actionMsg.action!.onClick(); setActionMsg(null) } : undefined}>{actionMsg.text}</span>
              {/* Optional action (e.g. "Openen" after a restore) — underlined link-button. */}
              {actionMsg.action && (
                <button onClick={() => { actionMsg.action!.onClick(); setActionMsg(null) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12.5, fontWeight: 600, textDecoration: 'underline', color: 'inherit' }}>
                  {actionMsg.action.label}
                </button>
              )}
              <button onClick={() => setActionMsg(null)} aria-label={t('close', { ns: 'common' })}
                style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}>
                <X size={13} />
              </button>
            </div>
          )}

          {/* Toolbar — bulk-bar zodra er selectie is, anders de toevoeg-knop */}
          <div style={{ padding: '0 24px 12px', display: 'flex', gap: 10, alignItems: 'center', minHeight: 36, flexShrink: 0 }}>
            {selectedIds.size > 0 ? (
              <CandidatesBulkBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}
                onAddToPool={bulkAddToPool} onRemoveFromPool={bulkRemoveFromPool}
                onSetOwner={bulkSetOwner} onSetStage={bulkSetStage} onSetTypes={bulkSetTypes} onSetConsent={bulkSetConsent}
                onConvertPhase={bulkConvertPhase} onSetStatus={bulkSetStatus} onAddTag={bulkAddTag}
                onRemoveTag={bulkRemoveTag} onAddNote={bulkAddNote} onArchive={bulkArchive}
                canArchive={hasPermission('candidates.delete')}
                users={users} funnelTypes={funnelTypes} candidateTypes={candidateTypes} phases={phases} statuses={statuses} selectedTags={selectedTags} />
            ) : (
              <>
                {/* Add on the left (like Applications) */}
                <button onClick={() => setAddOpen(true)} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 500,
                  background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                  + {t('page.add')}
                </button>
                {/* Shared header search (T10) — debounced, drives the same server-side ?search=. */}
                <HeaderSearch key={searchEpoch} onSearch={setGlobalSearch} defaultValue={globalSearch}
                  placeholder={t('page.searchPlaceholder')} width={300} />
                <ClearFiltersButton active={anyFilterActive} onClear={clearAllFilters} />
                {/* Quick-view toggles on the right: blacklisted-only + archived-only */}
                <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                  {/* Shared quick-view toggles (§4 soft convention) — one component everywhere. */}
                  <QuickViewToggle active={blacklistActive} onToggle={toggleBlacklist}
                    label={t('page.blacklistView')} color="var(--color-danger)" icon={Ban} />
                  <QuickViewToggle active={showArchived} onToggle={() => { setShowArchived(v => !v); setShowTrash(false) }}
                    label={t('page.archivedView')} icon={Archive} />
                  <QuickViewToggle active={showTrash} onToggle={() => { setShowTrash(v => !v); setShowArchived(false) }}
                    label={t('erase.trashView')} color="var(--color-danger)" icon={Trash2} />
                  {/* STRAAL-1: table ⇄ map (radius search) — same shared toggle look. */}
                  <QuickViewToggle active={view === 'map'} onToggle={() => setView(v => (v === 'map' ? 'table' : 'map'))}
                    label={t('common:map.view')} color="var(--color-primary)" icon={MapIcon} />
                </div>
              </>
            )}
          </div>

          {/* Map view (STRAAL-1 v2, Danny 2026-07-06): map LEFT, the filtered candidate
              table RIGHT — one radius search drives both panes. Lazy Leaflet load. */}
          {view === 'map' ? (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14, padding: '0 24px 16px' }}>
              <div style={{ flex: '1.1 1 0', minWidth: 400, display: 'flex', flexDirection: 'column' }}>
                <Suspense fallback={<div style={{ padding: 24, fontSize: 12, color: 'var(--text-muted)' }}>{t('common:map.loading')}</div>}>
                  <CandidatesMapView rows={filtered} center={mapCenter} radiusKm={mapRadius} padded={false}
                    onCenterChange={(lat, lng) => setMapCenter({ lat, lng })}
                    onRadiusChange={setMapRadius}
                    onPick={(id) => selectCandidate({ id } as Candidate)} />
                </Suspense>
              </div>
              {/* Right pane: the same server-filtered rows as a table (row click = drawer). */}
              <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                  <CandidatesTable rows={filtered} loading={loading} selectedId={selected?.id}
                    onSelect={selectCandidate} onOpenTab={(c, tab) => selectCandidate(c, tab)} />
                </div>
                <PaginationBar page={page} totalPages={lastPage} totalRows={total} pageSize={pageSize}
                  onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />
              </div>
            </div>
          ) : (
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '0 24px 16px' }}>
            {error && (
              <div className="mb-3 rounded-lg px-3 py-2.5 text-sm text-red-600 bg-red-50 border border-red-200">
                {error}
              </div>
            )}
            <CandidatesTable
              rows={filtered}
              loading={loading}
              selectedId={selected?.id}
              onSelect={selectCandidate}
              onOpenTab={(c, tab) => selectCandidate(c, tab)}
              selectable
              selectedIds={selectedIds}
              onToggleRow={toggleRow}
              onToggleAll={toggleAll}
              stickyHeader
            />
          </div>
          )}

          {view !== 'map' && <PaginationBar
            page={page}
            totalPages={lastPage}
            totalRows={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />}
        </div>

        {/* Drawer — remounts (key) when the full detail arrives so the tabs
            re-initialise from the complete record instead of the light row. */}
        <CandidateDrawer
          key={selected ? `${selected.id}-${detail ? 'full' : 'lite'}` : 'none'}
          candidate={detail ?? selected}
          onClose={closeDrawer}
          expanded={drawerExpanded}
          onToggleExpand={() => setDrawerExpanded(v => !v)}
          onUpdate={updateCandidate}
          onArchive={archiveOne}
          onMarkDeletion={markDeletionOne}
          onRestore={restoreOne}
          onHardDelete={hardDeleteOne}
          users={users}
          initialTab={drawerTab}
        />

        {/* Erase/archive-guard confirm popups (ERASE-1 + §3B) — bundled in one thin
            component purely for CandidatesPage size discipline (§0.3). */}
        <CandidateLifecycleModals
          eraseTarget={eraseTarget} onCloseErase={() => setEraseTarget(null)} onConfirmErase={confirmHardDelete}
          archiveGuard={archiveGuard} onCloseArchiveGuard={() => setArchiveGuard(null)} onResolveArchiveGuard={resolveArchiveGuard}
          bulkArchiveGuard={bulkArchiveGuard} onCloseBulkArchiveGuard={() => setBulkArchiveGuard(null)} onResolveBulkArchiveGuard={resolveBulkArchiveGuard}
        />
      </div>
    </>
  )
}
