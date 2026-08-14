import { useState, useEffect, useMemo, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutList, Kanban, Plus, Archive, MessageCircle, Pause, Users, X } from 'lucide-react'
import ViewModeToggle from '@/components/ui/ViewModeToggle'
import { useRightPanel } from '@/context/RightPanelContext'
import { useLookups } from '@/context/LookupsContext'
import { useAuth } from '@/context/AuthContext'
import { useUsers } from '@/lib/queries'
import { useBranchOptions } from '@/lib/useBranchOptions'
import { useOpenFromIntent } from '@/context/NavigationContext'
import { useDrawerUrl } from '@/hooks/useDrawerUrl'
import { usePageMemory } from '@/lib/usePageMemory'
import { useListPageSize } from '@/hooks/useListPageSize'
import { useApplicationFilters, OWNER_NONE } from './hooks/useApplicationFilters'
import { useApplicationsData, APPLICATIONS_MAX_PER_PAGE } from './hooks/useApplicationsData'
import type { AppSort } from './hooks/useApplicationsData'
import { useApplicationDrawerActions } from './hooks/useApplicationDrawerActions'
import { useApplicationBulkActions } from './hooks/useApplicationBulkActions'
import InsightsRow from '@/components/insights/InsightsRow'
import ApplicationsTable from './ApplicationsTable'
import ApplicationsBoard from './ApplicationsBoard'
import type { BoardPhase } from './ApplicationsBoard'
import ApplicationDrawer from './ApplicationDrawer'
import ApplicationsBulkBar from './ApplicationsBulkBar'
import AddApplicationModal from './AddApplicationModal'
import PhaseChangeAppointmentWarning from './PhaseChangeAppointmentWarning'
import PaginationBar from '@/components/ui/PaginationBar'
import HeaderSearch from '@/components/ui/HeaderSearch'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import { BTN_H } from '@/config/buttonMetrics'
import {
  buildPhaseData, buildOwnerData, buildSourceData, buildOwnerDataFromStats, buildSourceDataFromStats,
  buildVacOptions, buildClientOptions, buildBucketData, asOptions,
  bucketCount, placedCount, computeAvgScore, computeAiTaskCount, buildApplicationInsights,
} from './data/applicationInsights'
import { buildApplicationFilterGroups } from './data/applicationFilterGroups'
import type { Application } from '@/types/application'
import type { Id } from '@/types/common'

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
  // Detach/restore are destructive → gate in the UI (backend re-checks the perm).
  const canManage = auth?.hasPermission?.('applications.update') ?? false
  const { registerFilters, unregisterFilters } = useRightPanel()
  // Funnel phases come from the tenant lookup (Settings → Funnel stages), never hardcoded.
  const { funnelTypes, funnelMeta } = useLookups()
  // Tenant users — options for the editable recruiter (owner) picker in the drawer.
  const { data: users = [] } = useUsers() as { data?: Array<{ id: Id; name: string }> }
  // VESTIGING-2: the branch values this user may filter on — see useBranchOptions for
  // why an empty scope means unrestricted rather than none.
  const branchOptions = useBranchOptions()

  const [view,         setView]         = usePageMemory('apps.view', 'table')   // 'table' | 'board'
  const [page,         setPage]         = usePageMemory('apps.page', 1)
  // Shared page-size hook (§ audit 2026-08-05): clamped to the backend's
  // ApplicationQuery ceiling (APPLICATIONS_MAX_PER_PAGE) so a tenant preference
  // above it never 422s, AND kept sticky across the shell's unmount-on-navigate
  // like every other bit of page state here — this used to be the one `useState`
  // NOT behind usePageMemory, so an explicit pick reverted to the seeded default
  // on the next visit (measured root cause of "rows-per-page kan niet op 50
  // gezet worden", Danny 2026-08-05).
  const { pageSize, setPageSize: setPageSizeClamped, options: pageSizeOptions } =
    useListPageSize('apps', APPLICATIONS_MAX_PER_PAGE)
  // DATATABLE-SORT-1 reference adoption: the table's controlled sort, lifted here
  // (sticky like every other filter above) so a header click can ALSO drive a
  // real server-side sort_by/sort_dir request via useApplicationsData, not just
  // reorder the currently loaded page. Defaults to the same "newest first" the
  // uncontrolled table used before this change (see ApplicationsTable's own
  // defaultSort fallback) — the resulting order is identical either way.
  const [sort, setSort] = usePageMemory<AppSort | null>('apps.sort', { by: 'created', dir: 'desc' })
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
    selectedVac, setSelectedVac, selectedClient, setSelectedClient,
    showArchived, setShowArchived, showTrash, setShowTrash, query, setQuery,
    interviewBusy, setInterviewBusy, interviewPaused, setInterviewPaused, refMode,
    selectedBranch, setSelectedBranch,
    selectedCandidateIds, setSelectedCandidateIds,
    dateRange, setDateRange,
    anyFilterActive, clearAllFilters, searchEpoch, matchesFilters,
    filterParams, bucketParam,
  } = useApplicationFilters()
  // ── Data layer (F-6, W27): server-paginated table page + the server-wide stats
  // (real by_owner/by_source/avg_score/attention) + a wide (bucket-less) sample
  // that feeds the board and — only when stats itself failed — the same figures'
  // fallback. See useApplicationsData's header comment for the verified contract.
  const { applications, setApplications, loading, error, total, setTotal, lastPage,
    wideRows, wideLoading, wideError, wideIsPartial, stats, statsFailed } =
    useApplicationsData({ view, filterParams, bucketParam, page, pageSize, funnelTypes, sort })
  const [selectedIds,    setSelectedIds]    = useState<Set<Id>>(() => new Set())

  // Clear the selection whenever the visible set changes (bucket/filters/paging).
  useEffect(() => { setSelectedIds(new Set()) },
    [bucket, showArchived, showTrash, interviewBusy, interviewPaused, page, pageSize,
      selectedPhase, selectedOwner, selectedSource, selectedVac, selectedClient, query])

  // Board columns = the funnel lookup, normalised to { key, label, color }.
  const phases = useMemo<BoardPhase[]>(() => funnelTypes.map(f => ({ key: f.value, label: f.label, color: f.color })), [funnelTypes])

  // Resolve an application's phase label/colour from the lookup (de-hardcoded).
  const decorate = <T extends Application>(a: T): T => { const m = funnelMeta(a.phaseKey); return { ...a, phaseLabel: m.label, phaseColor: m.color } }

  // ── Single-record drawer actions (select/move/owner/link/reject/score/detach/…)
  // — §0.3 split (F1, audit R1): mirrors useCandidateDrawerActions.
  const {
    selected, expanded, setExpanded, closeDrawer, selectApplication, openTab,
    handleMove, handleOwner, handleLinkVacancy, handleUpdateSource, handleReject,
    handleAdjustScore, handleUpdateCustomFields, handleCandidateUpdated, handleDetach, handleRestore,
    pendingMove, confirmPendingMove, cancelPendingMove,
  } = useApplicationDrawerActions({ applications, wideRows, setApplications, setTotal, funnelTypes, users, bucket, decorate, t })

  // ── Bulk selection + mutations — §0.3 split (F1, audit R1): mirrors useCandidateBulkActions.
  const { toggleRow, toggleAll, bulkSetPhase, bulkDetach } =
    useApplicationBulkActions({ applications, setApplications, setTotal, selectedIds, setSelectedIds, funnelTypes, t })

  // ── Donut data (phase / recruiter / source) + filter option lists — pure
  // aggregate builders (F1, audit R1: data/applicationInsights.ts). W27: owner/
  // source prefer the REAL server-wide stats; only fall back to the wide sample
  // when stats itself hasn't loaded (mirrors phaseCount/bucketCount's own
  // per-field fallback, already established above).
  const phaseData  = useMemo(() => buildPhaseData(phases, stats, wideRows), [phases, stats, wideRows])
  const ownerData  = useMemo(() => stats?.by_owner
    ? buildOwnerDataFromStats(stats.by_owner, t('insights.noOwner'), OWNER_NONE)
    : buildOwnerData(wideRows, t('insights.noOwner'), OWNER_NONE), [stats, wideRows, t])
  const sourceData = useMemo(() => stats?.by_source
    ? buildSourceDataFromStats(stats.by_source)
    : buildSourceData(wideRows), [stats, wideRows])
  const vacOptions = useMemo(() => buildVacOptions(wideRows), [wideRows])
  // W27: customer/client filter options — new dimension (customer_id[]).
  const clientOptions = useMemo(() => buildClientOptions(wideRows), [wideRows])
  // Bucket counts + donut data (Danny 14-08: replaces the old toolbar tab row) —
  // real server-wide totals via stats.by_bucket when available (bucketCount's
  // own per-bucket fallback covers the rest). PLACED-1 (2026-08-14): "placed" is
  // the 4th slice, a subset of "matched" (both come from the same additive
  // stats.by_bucket.placed / row-level has_match — see placedCount).
  const bucketCounts = useMemo(() => ({
    active: bucketCount(stats, wideRows, 'active'),
    matched: bucketCount(stats, wideRows, 'matched'),
    rejected: bucketCount(stats, wideRows, 'rejected'),
    placed: placedCount(stats, wideRows),
  }), [stats, wideRows])
  const bucketData = useMemo(() => buildBucketData(t, bucketCounts), [t, bucketCounts])
  // Bucket options for the right filter panel — one truth with the donut/deep-link
  // state (Danny 14-08: "en natuurlijk staat alles rechts in het filtermenu").
  const bucketOptions = useMemo(() => asOptions(bucketData), [bucketData])

  // Register the right-panel filters. Config lives in the data/ builder (mirrors
  // buildCandidateFilterGroups/buildCustomerFilterGroups) — categorised groups +
  // archived/trash/period, not just the bare phase/owner/source/vacancy/client set.
  const filterGroups = useMemo(() => buildApplicationFilterGroups({
    t, tog,
    filters: {
      bucket, setBucket, selectedPhase, setSelectedPhase, selectedOwner, setSelectedOwner,
      selectedSource, setSelectedSource, selectedVac, setSelectedVac,
      selectedClient, setSelectedClient, selectedBranch, setSelectedBranch,
      showArchived, setShowArchived, showTrash, setShowTrash, dateRange, setDateRange,
    },
    options: {
      bucketOptions, phaseOptions: asOptions(phaseData), ownerOptions: asOptions(ownerData), sourceOptions: asOptions(sourceData),
      vacOptions, clientOptions, branchOptions,
    },
  }), [t, bucket, selectedPhase, selectedOwner, selectedSource, selectedVac, selectedClient, selectedBranch,
    showArchived, showTrash, dateRange, bucketOptions, phaseData, ownerData, sourceData, vacOptions, clientOptions, branchOptions]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    registerFilters('applications-page', filterGroups)
    return () => unregisterFilters('applications-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // Reset to the first page whenever the bucket, any filter, or the sort changes
  // (DATATABLE-SORT-1: a new order restarts pagination, same as every filter above).
  useEffect(() => { setPage(1) }, [bucket, attention, selectedPhase, selectedOwner, selectedSource, selectedVac,
    selectedClient, showArchived, showTrash, dateRange, interviewBusy, interviewPaused, query, selectedCandidateIds, sort])

  // TABLE rows: the server's page — W27: now narrowed server-side by every filter
  // (bucket/phase_key/vacancy_id/owner_id/source/customer_id/search-or-ref/
  // include_archived/interview_status/branch_id/candidate_ids, see
  // useApplicationFilters). The client refine left below only covers the ONE
  // documented BE gap (the "No owner" sentinel, no IS-NULL support) and the
  // 'allActive' bucket union (spans two server buckets in one client-side OR).
  // Search is skipped here (ignoreQuery) — the server already ran it on a richer
  // field set; refMode additionally bypasses every other dimension, mirroring the
  // backend's own `ref` precedence (see matchesFilters' header comment).
  const tableRows = useMemo(() => applications.filter(a => matchesFilters(a, { ignoreQuery: true, refMode })).map(decorate),
    [applications, matchesFilters, refMode, funnelTypes]) // eslint-disable-line react-hooks/exhaustive-deps

  // BOARD rows: the wide (bucket-less) sample — the board shows the WHOLE funnel
  // regardless of the bucket tab (Danny 13/7), same client refine otherwise.
  const boardRows = useMemo(() => wideRows.filter(a => matchesFilters(a, { ignoreBucket: true, ignoreQuery: true, refMode })).map(decorate),
    [wideRows, matchesFilters, refMode, funnelTypes]) // eslint-disable-line react-hooks/exhaustive-deps

  // Open an application drawer when arriving via a cross-entity link (intent).
  useOpenFromIntent(intent, (id) => selectApplication({ id } as Application))

  // Mirror the open drawer in the URL (?open=<id>): browser back/forward walks
  // through it and a copied link reopens the same application (NAV-BACK-1;
  // supersedes the old memory-only remember).
  useDrawerUrl({ selectedId: selected?.id, openById: (id) => selectApplication({ id } as Application), close: closeDrawer, intent })

  // Shared clear-all (page memory keeps filters sticky): anything off-default resets.
  // Seed the funnel-stage filter from a dashboard chart click (funnel / funnel-conversion).
  // Mirrors the candidate status/recruiter drill-down: the InsightsRow then shows the active chip.
  // 11.1: a candidates-bulk "manage per application" deep-link also carries
  // `candidate_ids` — seeded into the (transient, not sticky) selectedCandidateIds
  // scope, see useApplicationFilters' header comment for the honest-gate reasoning.
  useEffect(() => {
    const i = intent as { stage?: string; vacancy?: string; candidate_ids?: Id[]; attention?: string } | undefined
    if (i?.stage) setSelectedPhase([i.stage])
    // A vacancy statistics-bar click carries the vacancy too — scope the list to it.
    if (i?.vacancy) setSelectedVac([String(i.vacancy)])
    if (i?.candidate_ids?.length) setSelectedCandidateIds(i.candidate_ids)
    // D6 dashboard tiles ("too long in stage" / "missing appointment") arrive as a
    // semantic attention intent — activate the matching server-wide filter.
    if (i?.attention) setAttention(i.attention)
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
  // figures computed here, assembled by the pure builder (F1, audit R1). W27:
  // avgScore/aiTasks/new prefer the real server-wide `stats.attention`/`avg_score`;
  // only fall back to the wide sample when stats itself hasn't loaded.
  const avgScore = useMemo(() => stats
    ? (stats.avg_score != null ? Math.round(stats.avg_score) + '%' : '—')
    : computeAvgScore(wideRows), [stats, wideRows])
  const aiTaskCount = useMemo(() => stats ? (stats.attention?.ai_tasks ?? 0) : computeAiTaskCount(wideRows), [stats, wideRows])
  // D6: no server-wide stats field for this yet (AppStats.attention has no
  // missing_appointment count) — derived from the loaded wide sample only, with
  // an honest sub-label on the card (STATS-HONEST-1).
  const missingAppointmentCount = useMemo(() => wideRows.filter(a => a.missingAppointment).length, [wideRows])
  // D6-KAART-2: real server-wide total; fall back to the wide sample only
  // while stats hasn't loaded yet (mirrors aiTaskCount's own fallback).
  const tooLongInStageCount = useMemo(() => stats
    ? (stats.attention?.too_long_in_stage ?? 0)
    : wideRows.filter(a => a.tooLongInStage).length, [stats, wideRows])
  const counts = useMemo(() => ({
    ...bucketCounts,
    new: stats ? (stats.attention?.new ?? 0) : wideRows.filter(a => a.isNew && a.bucket === 'active').length,
  }), [stats, wideRows, bucketCounts])
  const { donuts: insightDonuts, kpis: insightKpis } = buildApplicationInsights({
    t, phaseData, ownerData, sourceData, bucketData,
    selectedPhase, setSelectedPhase, selectedOwner, setSelectedOwner, selectedSource, setSelectedSource,
    bucket, setBucket, attention, setAttention, toggleAttention, showArchived, setShowArchived, clearAllFilters,
    counts, avgScore, aiTaskCount, missingAppointmentCount, tooLongInStageCount,
  })

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Insights strip (donuts + KPIs) */}
        <InsightsRow donuts={insightDonuts} kpis={insightKpis} clearTitle={t('insights.clearFilter')}
          // Data honesty (STATS-OOM-1, mirrors CandidatesPage): owner/source/avgScore/
          // aiTasks are real server-wide totals now (W27) — the notice only fires when
          // `/applications/stats` itself failed AND the wideRows fallback it's using
          // instead is itself an incomplete sample (statsFailed && wideIsPartial).
          // VESTIGING-2: an explicit branch filter EXCLUDES applications with no
          // branch yet — a resulting empty list must say so, not read as "nothing here".
          // S-board-1: the board view's columns are built straight from `wideRows`
          // (no stats-backed bucket source there), so a capped sample must be
          // disclosed regardless of whether /applications/stats itself is healthy —
          // stats health only matters for the table view's fallback path above.
          notice={(statsFailed && wideIsPartial) ? t('insights.pageScopeNotice')
            : (view === 'board' && wideIsPartial) ? t('insights.pageScopeNotice')
            : (selectedBranch.length > 0 && total === 0 ? t('common:filters.branchExcludesUnassigned') : undefined)} />

        {/* Tab bar — add + buckets + view toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between',
          padding: '0 24px 12px', minHeight: 36, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
            <button onClick={() => setAddOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 5,
              height: BTN_H, padding: '0 14px', fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', color: 'var(--color-on-accent)',
              border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              <Plus size={14} /> {t('add.button')}
            </button>
            {/* Shared header search (T10) — debounced, client-side text filter. */}
            <HeaderSearch key={searchEpoch} onSearch={setQuery} placeholder={t('page.searchPlaceholder')} width={300} />
            <ClearFiltersButton active={anyFilterActive} onClear={clearAllFilters} />
            {/* 11.1: the candidates-bulk deep-link scope — a soft chip (§4 convention)
                showing the selection-based filter is active, clearable on its own
                (independent of the general clear-filters button above). */}
            {selectedCandidateIds.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 10px', borderRadius: 7,
                background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)',
                color: 'var(--color-primary-text)', fontSize: 12, fontWeight: 500 }}>
                <Users size={13} />
                {t('page.scopedBySelection', { count: selectedCandidateIds.length })}
                <button onClick={() => setSelectedCandidateIds([])} aria-label={t('page.clearScope')}
                  style={{ display: 'flex', border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>
                  <X size={13} />
                </button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* No status bucket tabs here (Danny 14-08, "moet een donut worden!!"):
              the active/matched/rejected dimension moved to the insights-row
              donut (see bucketData/buildBucketData) and the right filter panel's
              bucket group — the state itself (`bucket`) is unchanged, only the
              toolbar control was removed to stop the duplication. */}
          {/* Archived (detached) view — shared quick-view toggle (§4). */}
          <QuickViewToggle active={showArchived} onToggle={() => setShowArchived(v => !v)}
            label={t('archived.toggle')} color="var(--color-archive)" icon={Archive} />
          {/* INTERVIEW-PHASE-1 quick-views onto the universal category filter — the
              shared toggle (§4), never hand-rolled. Mutually exclusive: each toggle
              clears its sibling before flipping on (matches the server's single-value
              interview_status; both narrow to interview_status=busy|paused). */}
          <QuickViewToggle active={interviewBusy} onToggle={() => { setInterviewPaused(false); setInterviewBusy(v => !v) }}
            label={t('interview.filterBusy')} color="var(--color-info)" icon={MessageCircle} />
          {/* W27: "Paused" — was missing entirely (no client or server filter for it);
              now a real server-side interview_status=paused quick-view. */}
          <QuickViewToggle active={interviewPaused} onToggle={() => { setInterviewBusy(false); setInterviewPaused(v => !v) }}
            label={t('interview.category.paused')} color="var(--color-info)" icon={Pause} />
          {/* Table/board switcher — shared soft-tint component (§4), never a solid fill. */}
          <ViewModeToggle value={view} onChange={setView} options={[
            { id: 'table', icon: LayoutList, label: t('view.table') },
            { id: 'board', icon: Kanban, label: t('view.board') },
          ]} />
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
                scrollParentRef={tableScrollRef} sort={sort} onSortChange={setSort} />
            </div>
            <PaginationBar page={page} totalPages={lastPage} totalRows={total}
              pageSize={pageSize} onPageChange={setPage} pageSizeOptions={pageSizeOptions}
              // useListPageSize's setPageSize already clamps to APPLICATIONS_MAX_PER_PAGE.
              onPageSizeChange={n => { setPageSizeClamped(n); setPage(1) }} />
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
        onCandidateUpdated={handleCandidateUpdated}
        // PDF-SOLLICITATIES points 6/7 (14-08): a table cell (Vacature/Interview)
        // can request opening straight on that tab instead of the default.
        initialTab={openTab}
      />

      {addOpen && <AddApplicationModal onClose={() => setAddOpen(false)} onCreated={handleCreated} />}

      {/* V-appdetail-2: warn-not-block confirm for a move onto a requires_appointment
          phase with no appointment planned yet — never blocks the move itself. */}
      {pendingMove && (
        <PhaseChangeAppointmentWarning phaseLabel={pendingMove.phaseLabel}
          onConfirm={confirmPendingMove} onCancel={cancelPendingMove} />
      )}
    </div>
  )
}
