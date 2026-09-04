/**
 * ApplicationsPage — thin container (§0.3 split, mirrors CandidatesPage): owns
 * the UI/view state (page, view mode, selection) and composes the filters hook,
 * the data hook, the drawer-actions hook, the bulk-actions hook and the pure
 * insights builder, then renders the list panel + drawer. The list chrome
 * (insights row, toolbar, table/board + pagination) lives in
 * ./ApplicationsListPanel (§0.3 split, mirrors CandidatesListPanel) — a dumb
 * rendering cluster fed entirely by props/callbacks from here. Heavy logic
 * lives in ./hooks and ./data.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { useRightPanel } from '@/context/RightPanelContext'
import { useLookups } from '@/context/LookupsContext'
import { useAuth } from '@/context/AuthContext'
import { usePublishSelection } from '@/context/SelectionContext'
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
import ApplicationsListPanel from './ApplicationsListPanel'
import type { BoardPhase } from './ApplicationsBoard'
import ApplicationDrawer from './ApplicationDrawer'
import AddApplicationModal from './AddApplicationModal'
import PhaseChangeAppointmentWarning from './PhaseChangeAppointmentWarning'
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

// Thin container: wires the filters/data/drawer-action/bulk-action hooks together and
// renders the list panel plus drawer — the mutation and aggregation logic all lives in those hooks.
export default function ApplicationsPage({ intent }: { intent?: unknown } = {}) {
  const { t } = useTranslation('applications')
  const auth = useAuth()
  // Detach/restore are destructive → gate in the UI (backend re-checks the perm).
  const canManage = auth?.hasPermission?.('applications.update') ?? false
  // hidden without the create permission (OPENERS-HIDE-1, Danny 05-09), same
  // as every other page toolbar.
  const canCreateApplication = auth?.hasPermission?.('applications.create') ?? false
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
  // gezet worden" — "rows-per-page can't be set to 50", Danny 2026-08-05).
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
    selectedCandidateOwnerId, setSelectedCandidateOwnerId,
    dateRange, setDateRange,
    anyFilterActive, clearAllFilters, searchEpoch, matchesFilters,
    filterParams, bucketParam,
  } = useApplicationFilters()
  // ── Data layer (F-6, W27): server-paginated table page + the server-wide stats
  // (real by_owner/by_source/avg_score/attention) + a wide (bucket-less) sample
  // that feeds the board and — only when stats itself failed — the same figures'
  // fallback. See useApplicationsData's header comment for the verified contract.
  const { applications, setApplications, loading, error, total, setTotal, lastPage,
    wideRows, wideLoading, wideError, wideIsPartial, stats, statsFailed, rowsEpoch, fetching } =
    useApplicationsData({ view, filterParams, bucketParam, page, pageSize, funnelTypes, sort })
  const [selectedIds,    setSelectedIds]    = useState<Set<Id>>(() => new Set())
  // KOIOS-SELECTIE-CONTEXT-1: mirror the selection into Koios AI's context chip.
  usePublishSelection('applications', selectedIds)

  // Clear the selection whenever the visible set changes (bucket/filters/paging).
  // SELECT-RACE-1: rowsEpoch (bumped only when a NEW server result actually
  // lands, see useApplicationsData) closes the race where a select-all made
  // against the stale rows during a filter/page fetch survived the swap — the
  // input-triggered clear above fires too early to catch that window on its own.
  useEffect(() => { setSelectedIds(new Set()) },
    [bucket, showArchived, showTrash, interviewBusy, interviewPaused, page, pageSize,
      selectedPhase, selectedOwner, selectedSource, selectedVac, selectedClient, query, rowsEpoch])

  // Board columns = the funnel lookup, normalised to { key, label, color }.
  const phases = useMemo<BoardPhase[]>(() => funnelTypes.map(f => ({ key: f.value, label: f.label, color: f.color })), [funnelTypes])

  // Resolve an application's phase label/colour from the lookup (de-hardcoded).
  const decorate = <T extends Application>(a: T): T => { const m = funnelMeta(a.phaseKey); return { ...a, phaseLabel: m.label, phaseColor: m.color } }

  // ── Single-record drawer actions (select/move/owner/link/reject/score/detach/…)
  // — §0.3 split (F1, audit R1): mirrors useCandidateDrawerActions.
  const {
    selected, expanded, setExpanded, closeDrawer, selectApplication, openTab, detailPhase,
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
  // Recruiter (owner) donut: prefer the real server-wide stats.by_owner; only fall
  // back to counting the wide sample while stats hasn't loaded.
  const ownerData  = useMemo(() => stats?.by_owner
    ? buildOwnerDataFromStats(stats.by_owner, t('insights.noOwner'), OWNER_NONE)
    : buildOwnerData(wideRows, t('insights.noOwner'), OWNER_NONE), [stats, wideRows, t])
  // Source donut: same stats-first, wide-sample-fallback pattern as ownerData above.
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
  // state (Danny 14-08: "en natuurlijk staat alles rechts in het filtermenu" —
  // "and naturally everything sits on the right in the filter menu").
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
  }), [t, bucket, setBucket, selectedPhase, setSelectedPhase, selectedOwner, setSelectedOwner, selectedSource, setSelectedSource,
    selectedVac, setSelectedVac, selectedClient, setSelectedClient, selectedBranch, setSelectedBranch,
    showArchived, setShowArchived, showTrash, setShowTrash, dateRange, setDateRange,
    bucketOptions, phaseData, ownerData, sourceData, vacOptions, clientOptions, branchOptions])

  // Register this page's filter groups with the shared right panel (§4: every filter
  // lives there, never in the toolbar); unregister on unmount so it doesn't leak to other pages.
  useEffect(() => {
    registerFilters('applications-page', filterGroups)
    return () => unregisterFilters('applications-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // Reset to the first page whenever the bucket, any filter, or the sort changes
  // (DATATABLE-SORT-1: a new order restarts pagination, same as every filter above).
  useEffect(() => { setPage(1) }, [bucket, attention, selectedPhase, selectedOwner, selectedSource, selectedVac,
    selectedClient, showArchived, showTrash, dateRange, interviewBusy, interviewPaused, query, selectedCandidateIds,
    selectedCandidateOwnerId, sort, setPage])

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
  // The result-card/child-ref tab rides along — selectApplication already speaks tab.
  useOpenFromIntent(intent, (id, tab) => selectApplication({ id } as Application, tab))

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
    const i = intent as { stage?: string; vacancy?: string; candidate_ids?: Id[]; attention?: string; candidate_owner_id?: Id } | undefined
    if (i?.stage) setSelectedPhase([i.stage])
    // A vacancy statistics-bar click carries the vacancy too — scope the list to it.
    if (i?.vacancy) setSelectedVac([String(i.vacancy)])
    if (i?.candidate_ids?.length) setSelectedCandidateIds(i.candidate_ids)
    // D6 dashboard tiles ("too long in stage" / "missing appointment") arrive as a
    // semantic attention intent — activate the matching server-wide filter.
    if (i?.attention) setAttention(i.attention)
    // RAPPORT-APPS-VERDIEPING-1: dashboard candidate-owner drill (tile↔list parity).
    if (i?.candidate_owner_id) setSelectedCandidateOwnerId(i.candidate_owner_id)
  }, [intent, setAttention, setSelectedCandidateIds, setSelectedPhase, setSelectedVac, setSelectedCandidateOwnerId])

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
  // Bucket counts plus the "new" KPI, which prefers the server-wide stats total and
  // falls back to the wide sample only while stats hasn't loaded (same pattern as above).
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

      {/* List chrome (insights row, toolbar, table/board + pagination) — §0.3
          split into a dumb rendering cluster, mirrors CandidatesListPanel. */}
      <ApplicationsListPanel
        insightDonuts={insightDonuts} insightKpis={insightKpis}
        statsFailed={statsFailed} wideIsPartial={wideIsPartial}
        // VESTIGING-2: an explicit branch filter excludes applications with no
        // branch yet — a resulting empty list must say so (see the panel's own notice logic).
        branchFilterExcludesAll={selectedBranch.length > 0 && total === 0}
        onAddOpen={() => setAddOpen(true)} canCreate={canCreateApplication}
        searchEpoch={searchEpoch} onSearch={setQuery}
        anyFilterActive={anyFilterActive} onClearFilters={clearAllFilters}
        candidateScopeCount={selectedCandidateIds.length} onClearCandidateScope={() => setSelectedCandidateIds([])}
        showArchived={showArchived} onToggleArchived={() => setShowArchived(v => !v)}
        interviewBusy={interviewBusy} onToggleInterviewBusy={() => { setInterviewPaused(false); setInterviewBusy(v => !v) }}
        interviewPaused={interviewPaused} onToggleInterviewPaused={() => { setInterviewBusy(false); setInterviewPaused(v => !v) }}
        view={view} onViewChange={setView}
        selectedCount={selectedIds.size} onClearSelection={() => setSelectedIds(new Set())}
        onBulkSetPhase={bulkSetPhase} onBulkDetach={bulkDetach} canManage={canManage} funnelPhases={funnelTypes}
        tableScrollRef={tableScrollRef} tableRows={tableRows} loading={loading} error={error}
        selectedId={selected?.id} onSelect={selectApplication}
        selectedIds={selectedIds} onToggleRow={toggleRow} onToggleAll={toggleAll} selectionBusy={fetching}
        sort={sort} onSortChange={setSort}
        page={page} lastPage={lastPage} total={total} pageSize={pageSize} pageSizeOptions={pageSizeOptions}
        onPageChange={setPage}
        // useListPageSize's setPageSize already clamps to APPLICATIONS_MAX_PER_PAGE.
        onPageSizeChange={n => { setPageSizeClamped(n); setPage(1) }}
        boardRows={boardRows} boardPhases={phases} onMove={handleMove}
        wideLoading={wideLoading} wideError={wideError}
      />

      {/* Detail drawer */}
      <ApplicationDrawer
key={selected?.id ?? 'none'}
        detailPhase={detailPhase}
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
