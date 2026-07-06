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
import { CheckCircle2, AlertTriangle, X, Ban, Archive, Map as MapIcon } from 'lucide-react'
import { useRightPanel } from '@/context/RightPanelContext'
import { useAuth } from '@/context/AuthContext'
import { useLookups } from '@/context/LookupsContext'
import { useGenders } from '@/lib/useGenders'
import { useUsers } from '@/lib/queries'
import api from '@/lib/api'
import CandidateDrawerJs from './CandidateDrawer'
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
import { useCandidateRecord } from './hooks/useCandidateMutations'
import { useOpenFromIntent } from '@/context/NavigationContext'
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
interface ActionMsg { type: string; text: string }
interface AppUser { id: Id; name: string; [k: string]: unknown }

// Still-untyped JS components — declare the props this page passes (typed boundary).
const CandidateDrawer = CandidateDrawerJs as ComponentType<{
  candidate: Candidate | null; onClose: () => void; expanded: boolean
  onToggleExpand: () => void; onUpdate: (id: Id, patch: Record<string, unknown>) => void
  onArchive?: (id: Id) => void; onRestore?: (id: Id) => void; onHardDelete?: (id: Id) => void
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
  const [selected,       setSelected]       = useState<Candidate | null>(null)
  const [drawerExpanded, setDrawerExpanded] = useState(false)
  const [addOpen,        setAddOpen]        = useState(false)
  // STRAAL-1: table ⇄ map view; the map searches server-side within centre+radius.
  const [view,           setView]           = usePageMemory<'table' | 'map'>('cand.viewMode', 'table')
  const [mapCenter,      setMapCenter]      = usePageMemory('cand.mapCenter', { lat: 52.09, lng: 5.12 })
  const [mapRadius,      setMapRadius]      = usePageMemory('cand.mapRadius', 30)
  const [detail,         setDetail]         = useState<Candidate | null>(null)
  const selectedIdRef = useRef<Id | null>(null)

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
    showArchived, setShowArchived,
    selectedStatus, setSelectedStatus, selectedFunnel, setSelectedFunnel,
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
  } = useCandidateOptions({ stats, candidates, locations, statuses, funnelTypes, candidateTypes, genders })

  // CAND-FILTERS option lists: pools (ids from the lookup), city/source (page-derived).
  const { poolItems } = usePools()
  const poolOptions   = useMemo(() => poolItems.map(p => ({ value: p.id, label: p.name })), [poolItems])
  const cityOptions   = useMemo(() => optsFrom(candidates.map(c => c.city).filter(Boolean) as string[]), [candidates])
  const sourceOptions = useMemo(() => optsFrom(candidates.map(c => (c as { source?: string | null }).source ?? '').filter(Boolean)), [candidates])


  const tog = <T,>(set: Dispatch<SetStateAction<T[]>>) => (v: T) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])
  // Klik-op-chart → zet precies één waarde, of wis bij nogmaals klikken (toggle).
  const pickOne = <T,>(set: Dispatch<SetStateAction<T[]>>) => (v: T | null | undefined) => { if (v != null) toggleOneValue(set, v) }
  const pickStatus = pickOne(setSelectedStatus)
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
      selectedStatus, setSelectedStatus, selectedFunnel, setSelectedFunnel,
      selectedType, setSelectedType, selectedTitle, setSelectedTitle,
      selectedPool, setSelectedPool, selectedCity, setSelectedCity,
      selectedProvince, setSelectedProvince, selectedGeslacht, setSelectedGeslacht,
      selectedOwner, setSelectedOwner, selectedLocation, setSelectedLocation,
      selectedSource, setSelectedSource,
      showArchived, setShowArchived, dateRange, setDateRange,
      geoFilter, geoHint, applyGeo, clearGeo,
    },
    options: { statusOptions, funnelOptions, typeOptions, titleOptions, poolOptions, cityOptions,
      provinceOptions, genderOptions, ownerOptions, locationOptions, sourceOptions },
  }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [t, showArchived, dateRange, geoFilter, geoHint,
   selectedStatus, selectedFunnel, selectedType, selectedTitle, selectedGeslacht, selectedProvince, selectedOwner, selectedLocation,
   selectedPool, selectedCity, selectedSource, poolOptions, cityOptions, sourceOptions,
   statusOptions, funnelOptions, typeOptions, titleOptions, genderOptions, provinceOptions, ownerOptions, locationOptions])

  useEffect(() => {
    registerFilters('candidates-page', filterGroups)
    return () => unregisterFilters('candidates-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // The only client-side refinement left is the attention tile (no server filter yet).
  const filtered = useMemo(() => {
    // Archived view shows only archived rows; otherwise archived (soft-deleted) hidden.
    const base = candidates.filter(c => (showArchived ? c.archived : !c.archived))
    // stale/never keep a page-local refine (correct predicates); no-follow-up has no correct client
    // predicate → it's server-side only (the no_followup param), so don't page-filter it here.
    if (attentionFilter === 'stale6m')        return base.filter(c => isStale(c, staleMonths))
    if (attentionFilter === 'neverContacted') return base.filter(isNeverContacted)
    if (attentionFilter === 'activeConv')     return base.filter(c => c.lastContactAt && new Date(c.lastContactAt).getTime() > convCutoff)
    return base
  }, [candidates, attentionFilter, showArchived, staleMonths])

  // Full-record load + edit persistence (fetch/PATCH live in the hook, §3).
  const { fetchDetail, patchCandidate } = useCandidateRecord()

  // Open a candidate: hand the light row to the drawer, then fetch the full record.
  // 404 ('gone') = a stale row (reseed / deleted elsewhere) → drop it + tell the user.
  // Deep-link target tab (contact-cell → communication, funnel-chip → work); row click = default.
  const [drawerTab, setDrawerTab] = useState<string | undefined>(undefined)
  const selectCandidate = (c: Candidate, tab?: string) => {
    setDrawerTab(tab)
    selectedIdRef.current = c.id
    setSelected(c); setDetail(null); setDrawerExpanded(false)
    // ARCHIVED rows: the detail endpoint 404s for soft-deleted records (ARCH-3, BE) —
    // open the drawer on the row data (banner + restore) instead of "bestaat niet meer".
    if (c.archived) return
    fetchDetail(c.id).then(full => {
      if (selectedIdRef.current !== c.id) return
      if (full === 'gone') {
        setCandidates(p => p.filter(x => x.id !== c.id))
        setTotal(v => Math.max(0, v - 1))
        closeDrawer()
        setActionMsg({ type: 'error', text: t('drawer.recordGone') })
        return
      }
      if (full) setDetail(full)
    })
  }
  const closeDrawer = () => { selectedIdRef.current = null; setSelected(null); setDetail(null); setDrawerExpanded(false) }

  // Archive ONE candidate from the drawer (soft-delete → Gearchiveerd view). Reuses the
  // bulk endpoint with a single id; the backend re-checks live links (§3B) and 409s.
  const archiveOne = async (id: Id) => {
    try {
      await api.post('/candidates/bulk/archive', { candidate_ids: [id] })
      setCandidates(p => p.filter(x => x.id !== id))
      setTotal(v => Math.max(0, v - 1))
      closeDrawer()
      setActionMsg({ type: 'success', text: t('drawer.archived') })
    } catch {
      setActionMsg({ type: 'error', text: t('drawer.archiveFailed') })
    }
  }
  // Restore an ARCHIVED candidate (undo the soft-delete) — mirrors archive via the bulk route.
  const restoreOne = async (id: Id) => {
    try {
      await api.post('/candidates/bulk/restore', { candidate_ids: [id] })
      setCandidates(p => p.filter(x => x.id !== id))
      setTotal(v => Math.max(0, v - 1))
      closeDrawer()
      setActionMsg({ type: 'success', text: t('drawer.restored') })
    } catch {
      setActionMsg({ type: 'error', text: t('drawer.restoreFailed') })
    }
  }
  // PERMANENTLY delete an archived candidate — admin-only (UI-gated in the drawer; the
  // backend re-checks the role and that nothing live hangs off the record — §3B/§7).
  const hardDeleteOne = async (id: Id) => {
    try {
      await api.delete(`/candidates/${id}/force`)
      setCandidates(p => p.filter(x => x.id !== id))
      setTotal(v => Math.max(0, v - 1))
      closeDrawer()
      setActionMsg({ type: 'success', text: t('drawer.hardDeleted') })
    } catch {
      setActionMsg({ type: 'error', text: t('drawer.hardDeleteFailed') })
    }
  }
  // Open a candidate drawer when arriving via a dashboard/cross-entity link ({ open: id }).
  useOpenFromIntent(intent, (id) => selectCandidate({ id } as Candidate))

  // Remember the open drawer across page switches; coming back reopens it (Danny
  // 2026-07-06: "opent ook niet vorige items"). Memory-only, mirrors usePageMemory.
  const [rememberedId, setRememberedId] = usePageMemory<Id | null>('cand.openId', null)
  useEffect(() => { setRememberedId(selected?.id ?? null) }, [selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (rememberedId && !selected) selectCandidate({ id: rememberedId } as Candidate) }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
  } = useCandidateBulkActions({ candidates, setCandidates, setTotal, selectedIds, setSelectedIds, notify, t, funnelTypes, candidateTypes })

  // Recharts hands the clicked segment back at top level AND under `.payload`.
  const pickKey = (d: { key?: unknown; name?: unknown; payload?: { key?: unknown } }) => d?.key ?? d?.payload?.key ?? d?.name

  // ── One strip: 3 donuts + KPI cards, all equal size ──
  const insightDonuts = [
    { key: 'status', title: t('analytics.statusTitle'), data: statusData, onPick: (d: { key?: unknown; name?: unknown; payload?: { key?: unknown } }) => pickStatus(pickKey(d) as string),
      active: selectedStatus.length > 0, onClear: () => setSelectedStatus([]) },
    { key: 'funnel', title: t('analytics.funnelTitle'), data: funnelData, onPick: (d: { key?: unknown; name?: unknown; payload?: { key?: unknown } }) => pickFunnel(pickKey(d) as string),
      active: selectedFunnel.length > 0, onClear: () => setSelectedFunnel([]) },
    { key: 'rc',     title: t('analytics.rcTitle'),     data: rcData,     onPick: (d: { key?: unknown; name?: unknown; payload?: { key?: unknown } }) => pickOwner(pickKey(d) as string),
      active: selectedOwner.length > 0, onClear: () => setSelectedOwner([]) },
  ]
  const insightKpis = [
    { key: 'stale',      label: t('analytics.staleMonths', { months: staleMonths }), value: staleCount, sub: t('analytics.stale6mSub'), color: 'var(--color-warning)',
      onClick: () => toggleAttention('stale6m'),    active: attentionFilter === 'stale6m' },
    { key: 'neverContacted', label: t('analytics.neverContacted'), value: neverContactedCount, sub: t('analytics.neverContactedSub'), color: '#0EA5E9',
      onClick: () => toggleAttention('neverContacted'), active: attentionFilter === 'neverContacted' },
    { key: 'noFollowup', label: t('analytics.noFollowup'), value: noFollowupCount, sub: t('analytics.noFollowupSub'), color: 'var(--color-danger)',
      onClick: () => toggleAttention('noFollowup'), active: attentionFilter === 'noFollowup' },
    { key: 'intake',     label: t('kpi.intake'),           value: intakeCount,     sub: t('kpi.intakeSub'),           color: '#8B5CF6',
      // Click filters on the SAME definition as the stat (planned intake appointments) via
      // the intake_planned param (INTAKE-1) — the old funnel-stage set never matched the count.
      onClick: () => toggleAttention('intakePlanned'), active: attentionFilter === 'intakePlanned' },
    // Channel breakdown is hidden until real WhatsApp/e-mail data exists (BE KPI-1) — no '–' placeholders.
    // "Actieve gesprekken" = contact in de laatste 14 dagen (zelfde proxy als de teller):
    // de kaart filtert de LIJST op precies die kandidaten (Danny 2026-07-06 — geen
    // WhatsApp-sprong meer: daar staan de gesprekken zelf nog niet).
    { key: 'conversations', label: t('analytics.conversations'), value: activeConvCount, color: 'var(--color-success)',
      onClick: () => toggleAttention('activeConv'), active: attentionFilter === 'activeConv' },
    { key: 'tasks', label: t('kpi.tasks'), value: tasksCount, sub: t('kpi.tasksSub'), color: '#0D9488',
      onClick: () => toggleAttention('hasTasks'), active: attentionFilter === 'hasTasks' },
  ]

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
              <span style={{ flex: 1 }}>{actionMsg.text}</span>
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
                  <QuickViewToggle active={showArchived} onToggle={() => setShowArchived(v => !v)}
                    label={t('page.archivedView')} icon={Archive} />
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
          onRestore={restoreOne}
          onHardDelete={hardDeleteOne}
          users={users}
          initialTab={drawerTab}
        />
      </div>
    </>
  )
}
