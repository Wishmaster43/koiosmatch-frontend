import { useState, useEffect, useMemo, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutList, Kanban, Plus, Archive, MessageCircle } from 'lucide-react'
import { useRightPanel } from '@/context/RightPanelContext'
import { useLookups } from '@/context/LookupsContext'
import { useAuth } from '@/context/AuthContext'
import { useUsers } from '@/lib/queries'
import { useOpenFromIntent } from '@/context/NavigationContext'
import { useDrawerUrl } from '@/hooks/useDrawerUrl'
import { usePageMemory } from '@/lib/usePageMemory'
import { useApplicationFilters, OWNER_NONE } from './hooks/useApplicationFilters'
import { useApplicationsData, APPLICATIONS_MAX_PER_PAGE } from './hooks/useApplicationsData'
import { useApplicationDrawerActions } from './hooks/useApplicationDrawerActions'
import { useApplicationBulkActions } from './hooks/useApplicationBulkActions'
import InsightsRow from '@/components/insights/InsightsRow'
import ApplicationsTable from './ApplicationsTable'
import ApplicationsBoard from './ApplicationsBoard'
import type { BoardPhase } from './ApplicationsBoard'
import ApplicationDrawer from './ApplicationDrawer'
import ApplicationsBulkBar from './ApplicationsBulkBar'
import AddApplicationModal from './AddApplicationModal'
import PaginationBar from '@/components/ui/PaginationBar'
import HeaderSearch from '@/components/ui/HeaderSearch'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import { BTN_H } from '@/config/buttonMetrics'
import {
  buildPhaseData, buildOwnerData, buildSourceData, buildVacOptions, asOptions,
  bucketCount, computeAvgScore, computeAiTaskCount, buildApplicationInsights,
} from './data/applicationInsights'
import type { Application } from '@/types/application'
import type { Id } from '@/types/common'

const BUCKETS = ['active', 'matched', 'rejected']

// Right-panel multi-toggle for a filter dimension.
const tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])

/**
 * ApplicationsPage — thin container (§0.3 split, mirrors CandidatesPage): owns
 * the UI/view state (page, view mode, selection) and composes the filters hook,
 * the data hook, the drawer-actions hook, the bulk-actions hook and the pure
 * insights builder, then renders the insights row + table/board + drawer. Heavy
 * logic lives in ./hooks and ./data.
 */
export default function ApplicationsPage({ intent }: { intent?: unknown } = {}) {
  const { t } = useTranslation('applications')
  const auth = useAuth()
  const user = auth?.user as { default_per_page?: number } | null | undefined
  // Detach/restore are destructive → gate in the UI (backend re-checks the perm).
  const canManage = auth?.hasPermission?.('applications.update') ?? false
  const { registerFilters, unregisterFilters } = useRightPanel()
  // Funnel phases come from the tenant lookup (Settings → Funnel stages), never hardcoded.
  const { funnelTypes, funnelMeta } = useLookups()
  // Tenant users — options for the editable recruiter (owner) picker in the drawer.
  const { data: users = [] } = useUsers() as { data?: Array<{ id: Id; name: string }> }

  const [view,         setView]         = usePageMemory('apps.view', 'table')   // 'table' | 'board'
  const [page,         setPage]         = usePageMemory('apps.page', 1)
  // Clamped to the backend's ApplicationQuery ceiling (`between:1,200`) — the
  // user's `default_per_page` profile setting is shared across entities and is
  // NOT capped for e.g. candidates, so a tenant with a higher preference would
  // otherwise 422 here (measured: a WIP request with per_page=500 broke the
  // pages-render/drill-downs/boards-drag smoke flows, 2026-07-15).
  const [pageSize,     setPageSize]     = useState(() => Math.min(user?.default_per_page ?? 50, APPLICATIONS_MAX_PER_PAGE))
  // Virtualization (F-7): the vertical scroll container the table body lives in.
  const tableScrollRef = useRef<HTMLDivElement>(null)
  // KPI-card attention toggle: null | 'new' | 'scored' | 'aiTasks' (one at a time).
  const toggleAttention = (k: string) => setAttention(p => (p === k ? null : k))
  const [addOpen,        setAddOpen]        = useState(false)
  // ALL filter state + the row predicate + the server filterParams live in one
  // hook (§0.3 size split).
  const {
    bucket, setBucket, selectedPhase, setSelectedPhase, attention, setAttention,
    selectedOwner, setSelectedOwner, selectedSource, setSelectedSource,
    selectedVac, setSelectedVac, showArchived, setShowArchived, query, setQuery,
    interviewBusy, setInterviewBusy,
    anyFilterActive, clearAllFilters, searchEpoch, matchesFilters,
    filterParams, bucketParam,
  } = useApplicationFilters()
  // ── Data layer (F-6): server-paginated table page + a wide (≤200, bucket-less)
  // sample that feeds the board and the owner/source/avgScore/aiTasks figures —
  // see useApplicationsData's header comment for the BE-gap rationale.
  const { applications, setApplications, loading, error, total, setTotal, lastPage,
    wideRows, wideLoading, wideError, wideIsPartial, stats } =
    useApplicationsData({ view, filterParams, bucketParam, page, pageSize, funnelTypes })
  const [selectedIds,    setSelectedIds]    = useState<Set<Id>>(() => new Set())

  // Clear the selection whenever the visible set changes (bucket/filters/paging).
  useEffect(() => { setSelectedIds(new Set()) },
    [bucket, showArchived, interviewBusy, page, pageSize, selectedPhase, selectedOwner, selectedSource, selectedVac, query])

  // Board columns = the funnel lookup, normalised to { key, label, color }.
  const phases = useMemo<BoardPhase[]>(() => funnelTypes.map(f => ({ key: f.value, label: f.label, color: f.color })), [funnelTypes])

  // Resolve an application's phase label/colour from the lookup (de-hardcoded).
  const decorate = <T extends Application>(a: T): T => { const m = funnelMeta(a.phaseKey); return { ...a, phaseLabel: m.label, phaseColor: m.color } }

  // ── Single-record drawer actions (select/move/owner/link/reject/score/detach/…)
  // — §0.3 split (F1, audit R1): mirrors useCandidateDrawerActions.
  const {
    selected, expanded, setExpanded, closeDrawer, selectApplication,
    handleMove, handleOwner, handleLinkVacancy, handleUpdateSource, handleReject,
    handleAdjustScore, handleUpdateCustomFields, handleDetach, handleRestore,
  } = useApplicationDrawerActions({ applications, wideRows, setApplications, setTotal, funnelTypes, users, bucket, decorate, t })

  // ── Bulk selection + mutations — §0.3 split (F1, audit R1): mirrors useCandidateBulkActions.
  const { toggleRow, toggleAll, bulkSetPhase, bulkDetach } =
    useApplicationBulkActions({ setApplications, setTotal, selectedIds, setSelectedIds, funnelTypes, t })

  // ── Donut data (phase / recruiter / source) + filter option lists — pure
  // aggregate builders (F1, audit R1: data/applicationInsights.ts).
  const phaseData  = useMemo(() => buildPhaseData(phases, stats, wideRows), [phases, stats, wideRows])
  const ownerData  = useMemo(() => buildOwnerData(wideRows, t('insights.noOwner'), OWNER_NONE), [wideRows, t])
  const sourceData = useMemo(() => buildSourceData(wideRows), [wideRows])
  const vacOptions = useMemo(() => buildVacOptions(wideRows), [wideRows])

  // Register the right-panel filters (phase + recruiter + source + vacancy).
  const filterGroups = useMemo(() => [
    { key: 'phase',   label: t('insights.phase'),  selected: selectedPhase,  options: asOptions(phaseData),  onToggle: tog(setSelectedPhase) },
    { key: 'owner',   label: t('insights.owner'),  selected: selectedOwner,  options: asOptions(ownerData),  onToggle: tog(setSelectedOwner) },
    { key: 'source',  label: t('insights.source'), selected: selectedSource, options: asOptions(sourceData), onToggle: tog(setSelectedSource) },
    { key: 'vacancy', label: t('cols.vacancy'),    selected: selectedVac,    options: vacOptions,            onToggle: tog(setSelectedVac) },
  ], [t, selectedPhase, selectedOwner, selectedSource, selectedVac, phaseData, ownerData, sourceData, vacOptions])

  useEffect(() => {
    registerFilters('applications-page', filterGroups)
    return () => unregisterFilters('applications-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // Reset to the first page whenever the bucket or any filter changes.
  useEffect(() => { setPage(1) }, [bucket, attention, selectedPhase, selectedOwner, selectedSource, selectedVac, showArchived, interviewBusy, query])

  // TABLE rows: the server's page (already narrowed by bucket/phase_key/vacancy_id/
  // search/include_archived where unambiguous — see useApplicationFilters), refined
  // client-side for the dimensions the backend can't filter yet (owner/source/
  // attention/'allActive'/multi-select on phase or vacancy). Search is skipped here
  // (ignoreQuery) — the server already ran it on a richer field set.
  const tableRows = useMemo(() => applications.filter(a => matchesFilters(a, { ignoreQuery: true })).map(decorate),
    [applications, matchesFilters, funnelTypes]) // eslint-disable-line react-hooks/exhaustive-deps

  // BOARD rows: the wide (≤200, bucket-less) sample — the board shows the WHOLE
  // funnel regardless of the bucket tab (Danny 13/7), same client refine otherwise.
  const boardRows = useMemo(() => wideRows.filter(a => matchesFilters(a, { ignoreBucket: true, ignoreQuery: true })).map(decorate),
    [wideRows, matchesFilters, funnelTypes]) // eslint-disable-line react-hooks/exhaustive-deps

  // Open an application drawer when arriving via a cross-entity link (intent).
  useOpenFromIntent(intent, (id) => selectApplication({ id } as Application))

  // Mirror the open drawer in the URL (?open=<id>): browser back/forward walks
  // through it and a copied link reopens the same application (NAV-BACK-1;
  // supersedes the old memory-only remember).
  useDrawerUrl({ selectedId: selected?.id, openById: (id) => selectApplication({ id } as Application), close: closeDrawer, intent })

  // Shared clear-all (page memory keeps filters sticky): anything off-default resets.
  // Seed the funnel-stage filter from a dashboard chart click (funnel / funnel-conversion).
  // Mirrors the candidate status/recruiter drill-down: the InsightsRow then shows the active chip.
  useEffect(() => {
    const i = intent as { stage?: string; vacancy?: string } | undefined
    if (i?.stage) setSelectedPhase([i.stage])
    // A vacancy statistics-bar click carries the vacancy too — scope the list to it.
    if (i?.vacancy) setSelectedVac([String(i.vacancy)])
  }, [intent])

  // A freshly created application: prepend to the list, bump the server-total
  // (F-6: total is no longer derived from the loaded array's length) and open its drawer.
  const handleCreated = (app: Application) => {
    setApplications(prev => [app, ...prev])
    setTotal(prev => prev + 1)
    setAddOpen(false)
    selectApplication(app)
  }

  // ── Insights strip: 3 donuts (filterable) + 6 KPI cards, equal footprint —
  // figures computed here, assembled by the pure builder (F1, audit R1).
  const avgScore = useMemo(() => computeAvgScore(wideRows), [wideRows])
  const aiTaskCount = useMemo(() => computeAiTaskCount(wideRows), [wideRows])
  const counts = useMemo(() => ({
    active: bucketCount(stats, wideRows, 'active'),
    matched: bucketCount(stats, wideRows, 'matched'),
    rejected: bucketCount(stats, wideRows, 'rejected'),
    new: wideRows.filter(a => a.isNew && a.bucket === 'active').length,
  }), [stats, wideRows])
  const { donuts: insightDonuts, kpis: insightKpis } = buildApplicationInsights({
    t, phaseData, ownerData, sourceData,
    selectedPhase, setSelectedPhase, selectedOwner, setSelectedOwner, selectedSource, setSelectedSource,
    bucket, setBucket, attention, setAttention, toggleAttention, showArchived, setShowArchived, clearAllFilters,
    counts, avgScore, aiTaskCount,
  })

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Insights strip (donuts + KPIs) */}
        <InsightsRow donuts={insightDonuts} kpis={insightKpis} clearTitle={t('insights.clearFilter')}
          // Data honesty (BE gap): owner/source/avgScore/aiTasks have no server-wide
          // aggregate and fall back to the ≤200-row wide sample — label it once that
          // sample doesn't cover every matching application (mirrors CandidatesPage).
          notice={wideIsPartial ? t('insights.pageScopeNotice') : undefined} />

        {/* Tab bar — add + buckets + view toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between',
          padding: '0 24px 12px', minHeight: 36, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
            <button onClick={() => setAddOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 5,
              height: BTN_H, padding: '0 14px', fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              <Plus size={14} /> {t('add.button')}
            </button>
            {/* Shared header search (T10) — debounced, client-side text filter. */}
            <HeaderSearch key={searchEpoch} onSearch={setQuery} placeholder={t('page.searchPlaceholder')} width={300} />
            <ClearFiltersButton active={anyFilterActive} onClear={clearAllFilters} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Bucket tabs — soft-tinted active (§4: never a solid fill). */}
          {BUCKETS.map(b => {
            const on = bucket === b && !showArchived
            return (
            <button key={b} onClick={() => { setShowArchived(false); setBucket(b) }} style={{ padding: '5px 14px', fontSize: 13,
              fontWeight: on ? 600 : 400, borderRadius: 7, cursor: 'pointer',
              background: on ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)' : 'transparent',
              color: on ? 'var(--color-primary)' : 'var(--text)',
              border: `1px solid ${on ? 'color-mix(in srgb, var(--color-primary) 45%, transparent)' : 'var(--border)'}` }}>
              {t(`buckets.${b}`)}
            </button>
            )
          })}
          {/* Archived (detached) view — shared quick-view toggle (§4). */}
          <QuickViewToggle active={showArchived} onToggle={() => setShowArchived(v => !v)}
            label={t('archived.toggle')} color="var(--color-archive)" icon={Archive} />
          {/* INTERVIEW-PHASE-1 v1 filter: a simple "In interview" quick-view onto the
              universal 'busy' category — the shared toggle (§4), never hand-rolled. */}
          <QuickViewToggle active={interviewBusy} onToggle={() => setInterviewBusy(v => !v)}
            label={t('interview.filterBusy')} color="var(--color-info)" icon={MessageCircle} />
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setView('table')} title={t('view.table')} aria-label={t('view.table')}
              style={{ padding: 6, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer',
                background: view === 'table' ? 'var(--color-primary)' : 'var(--surface)',
                color: view === 'table' ? '#fff' : 'var(--text)' }}>
              <LayoutList size={16} />
            </button>
            <button onClick={() => setView('board')} title={t('view.board')} aria-label={t('view.board')}
              style={{ padding: 6, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer',
                background: view === 'board' ? 'var(--color-primary)' : 'var(--surface)',
                color: view === 'board' ? '#fff' : 'var(--text)' }}>
              <Kanban size={16} />
            </button>
          </div>
          </div>
        </div>

        {/* Content — BOTH views stay mounted, the inactive one is display:none
            (APPS-VIRT-1): unmounting the table remounted the scroll container and
            @tanstack/react-virtual measured 0 height → 0 rows after board→table.
            Hiding instead keeps the virtualizer's measurements AND the board's
            drag state alive across toggles. */}
        <div style={{ display: view === 'table' ? 'contents' : 'none' }}>
            {/* Bulk action bar — shown above the table when ≥1 row is selected. */}
            {selectedIds.size > 0 && (
              <div style={{ padding: '8px 24px 0' }}>
                <ApplicationsBulkBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}
                  onSetPhase={bulkSetPhase} onDetach={bulkDetach} canManage={canManage} phases={funnelTypes} />
              </div>
            )}
            {/* Virtualized (F-7): tableScrollRef is the scroll container DataTable measures against. */}
            <div ref={tableScrollRef} style={{ flex: 1, overflow: 'auto', padding: '0 24px 16px' }}>
              <ApplicationsTable rows={tableRows} loading={loading} error={error}
                selectedId={selected?.id} onSelect={selectApplication} stickyHeader
                selectable selectedIds={selectedIds} onToggleRow={toggleRow} onToggleAll={toggleAll}
                scrollParentRef={tableScrollRef} />
            </div>
            <PaginationBar page={page} totalPages={lastPage} totalRows={total}
              pageSize={pageSize} onPageChange={setPage}
              // Clamp: PaginationBar's shared PAGE_SIZE_OPTIONS offers up to 500 (other
              // entities allow it) but ApplicationQuery caps per_page at 200 — see the
              // pageSize state comment above.
              onPageSizeChange={n => { setPageSize(Math.min(n, APPLICATIONS_MAX_PER_PAGE)); setPage(1) }} />
        </div>
        {view === 'board' && (
          <ApplicationsBoard rows={boardRows} phases={phases} onMove={handleMove}
            selectedId={selected?.id} onSelect={selectApplication}
            loading={wideLoading} error={wideError} />
        )}
      </div>

      {/* Detail drawer */}
      <ApplicationDrawer
        key={selected?.id ?? 'none'}
        application={selected}
        onClose={closeDrawer}
        expanded={expanded}
        onToggleExpand={() => setExpanded(v => !v)}
        onReject={handleReject}
        onAdjustScore={handleAdjustScore}
        onUpdateCustomFields={handleUpdateCustomFields}
        onPhaseChange={(id, key) => { if (id != null) handleMove(id, key) }}
        onOwnerChange={(id, ownerId) => { if (id != null) handleOwner(id, ownerId) }}
        onLinkVacancy={handleLinkVacancy}
        onUpdateSource={handleUpdateSource}
        users={users}
        onDetach={handleDetach}
        onRestore={handleRestore}
        canManage={canManage}
      />

      {addOpen && <AddApplicationModal onClose={() => setAddOpen(false)} onCreated={handleCreated} />}
    </div>
  )
}
