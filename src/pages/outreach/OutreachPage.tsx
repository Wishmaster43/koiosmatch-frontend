/**
 * OutreachPage — route page for the call lists ("bellijsten"). Follows the entity
 * blueprint (CLAUDE §3A) and mirrors the Opportunities page: an InsightsRow
 * (donuts + KPIs, click-to-filter), a toolbar with the create button on the LEFT
 * and an archived text-toggle + table/board view toggle on the RIGHT, a bulk bar
 * over the table, and a kanban board. The per-bellijst call-list detail is step 2.
 *
 * §0.3 size split: the archived/trash fetch lives in useOutreachArchivedCampaigns,
 * the filter state + row predicate in useOutreachFilters, the donut/KPI/board-column
 * derivation in useOutreachInsights (all in hooks/), and the toolbar row in
 * parts/OutreachToolbar — this file stays the thin composition + bulk/trash wiring.
 */
import { useState, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { notifyError, notifySuccess } from '@/lib/notify'
import { useAuth } from '@/context/AuthContext'
import { useRightPanel } from '@/context/RightPanelContext'
import { usePublishSelection } from '@/context/SelectionContext'
import InsightsRow from '@/components/insights/InsightsRow'
import { buildOutreachFilterGroups } from './data/outreachFilterGroups'
import { useDrawerUrl } from '@/hooks/useDrawerUrl'
import { useOpenFromIntent } from '@/context/NavigationContext'
import { usePageMemory } from '@/lib/usePageMemory'
import { useListPageSize } from '@/hooks/useListPageSize'
import { useOutreachCampaigns, OUTREACH_MAX_PER_PAGE } from './hooks/useOutreachCampaigns'
import type { Campaign } from './hooks/useOutreachCampaigns'
import { useOutreachArchivedCampaigns } from './hooks/useOutreachArchivedCampaigns'
import { useOutreachFilters } from './hooks/useOutreachFilters'
import { useOutreachInsights } from './hooks/useOutreachInsights'
import { updateCampaign, deleteCampaign, restoreCampaign } from './data/outreachApi'
import OutreachToolbar from './parts/OutreachToolbar'
import OutreachList from './OutreachList'
import OutreachBoard from './OutreachBoard'
import OutreachBulkBar from './OutreachBulkBar'
import OutreachCreate from './OutreachCreate'
import OutreachDrawer from './OutreachDrawer'
import PaginationBar from '@/components/ui/PaginationBar'
import DeletionPreviewModal from '@/components/ui/DeletionPreviewModal'
import { useTrashFlow } from '@/hooks/useTrashFlow'

// Right-panel multi-toggle for a filter dimension.
const tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string) =>
  set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])

// Route page for the call-lists (bellijsten) entity: insights row, toolbar,
// table/board view, bulk bar and the per-campaign drawer, wired to the trash flow.
export default function OutreachPage({ intent }: { intent?: unknown } = {}) {
  const { t } = useTranslation('outreach')
  const auth = useAuth()
  const hasPermission = (auth as unknown as { hasPermission?: (p: string) => boolean })?.hasPermission
  // TRASH-OVERAL-2 contract change: DELETE /outreach-campaigns/{id} (= archive) is
  // update-class now — planners without outreach.delete keep the archive action.
  const canArchive = hasPermission?.('outreach.update') ?? false
  // Restore/unmark are update-class too (BE gates both routes on outreach.update).
  const canRestore = hasPermission?.('outreach.update') ?? false
  // Mark-for-erasure stays delete-class (tenant-admin-seeded) — HIDDEN without it (§7).
  const canMarkDeletion = hasPermission?.('outreach.delete') ?? false
  // RIGHTS-GATE-OPENERS-1: mirrors outreach.create permission (backend:
  // tasks-outreach.php:118 POST /outreach-campaigns).
  const canCreateOutreach = hasPermission?.('outreach.create') ?? false
  // An unauthorized click gets an honest toast instead of a silent no-op — the
  // toolbar's create button itself always renders (§3).
  const handleCreateOpen = () => {
    if (!canCreateOutreach) { notifyError(t('page.createForbidden')); return }
    setCreating(true)
  }
  const { campaigns, loading, error, reload, add, patch, drop } = useOutreachCampaigns()
  // Marks the campaigns list stale while the drawer session mutates targets.
  const drawerDirtyRef = useRef(false)
  const { registerFilters, unregisterFilters } = useRightPanel()

  const [view, setView] = useState<'table' | 'board'>('table')
  // Pagination (audit 2026-08-05: "Bellijsten heeft niet eens een footer??") —
  // mirrors MatchesPage's wiring: useOutreachCampaigns already fetches the FULL
  // set client-side (page loop, see the hook), so this page only slices it for
  // display. Shared page-size hook seeds from user.default_per_page, clamps to
  // the endpoint's real per_page ceiling and stays sticky across navigation.
  const [page, setPage] = usePageMemory('outreach.page', 1)
  const { pageSize, setPageSize, options: pageSizeOptions } = useListPageSize('outreach', OUTREACH_MAX_PER_PAGE)
  // Drill-down: the opened bellijst (campaign) — row click opens the drawer.
  const [openId, setOpenId] = useState<string | null>(null)
  const [drawerExpanded, setDrawerExpanded] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  // TRASH-OVERAL-2: the Prullenbak view (lifecycle pending_erase) — exclusive with
  // the archived view; both read the same soft-deleted fetch.
  const [showTrash, setShowTrash] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  // KOIOS-SELECTIE-CONTEXT-1: mirror the selection into Koios AI's context chip.
  usePublishSelection('outreach', selectedIds)

  // Mirror the open drawer in the URL (?open=<id>): browser back/forward walks
  // through it and a copied link reopens the same call list (NAV-BACK-1).
  // KOIOS-RESULT-CARDS-6: calllist result cards target a campaign by id — the
  // cross-entity intent now opens the drawer directly (tab ignored: the outreach
  // drawer has no addressable sub-tabs today).
  useOpenFromIntent(intent, (id) => setOpenId(String(id)))
  useDrawerUrl({ selectedId: openId, openById: (id) => setOpenId(String(id)), close: () => setOpenId(null), intent })

  // Archived/trash campaigns — fetched lazily only while either quick view is open.
  const { archived, archLoading, archError, lifecycleOf, refetchArchived, removeArchived } = useOutreachArchivedCampaigns(showArchived, showTrash)

  // Filter state + the filtered row set (table + board share this).
  const filters = useOutreachFilters({ campaigns, archived, lifecycleOf, showArchived, showTrash })
  const { selectedStatus, setSelectedStatus, selectedChannel, setSelectedChannel,
    selectedOwner, setSelectedOwner, selectedTargetGroup, setSelectedTargetGroup,
    kpiTargets, setKpiTargets, query, filtered } = filters

  // Insights row (donuts + KPIs), board columns and the owner/target-group filter options.
  const { columns, statusData, channelData, ownerOptions, targetGroupOptions, insightDonuts, insightKpis } = useOutreachInsights({
    campaigns, selectedStatus, setSelectedStatus, selectedChannel, setSelectedChannel, kpiTargets, setKpiTargets,
  })

  // Register the right-panel filters (status/channel/owner/target-group/archived).
  const filterGroups = useMemo(() => buildOutreachFilterGroups({
    t, tog,
    selectedStatus, setSelectedStatus, selectedChannel, setSelectedChannel,
    selectedOwner, setSelectedOwner, selectedTargetGroup, setSelectedTargetGroup,
    showArchived, setShowArchived,
    statusOptions: statusData.map(d => ({ value: d.key, label: d.name, count: d.value })),
    channelOptions: channelData.map(d => ({ value: d.key, label: d.name, count: d.value })),
    ownerOptions, targetGroupOptions,
  }), [t, selectedStatus, selectedChannel, selectedOwner, selectedTargetGroup, showArchived, statusData, channelData, ownerOptions, targetGroupOptions,
    setSelectedStatus, setSelectedChannel, setSelectedOwner, setSelectedTargetGroup, setShowArchived])

  // Publish the current filter groups into the shared right panel; unregister on
  // unmount/change so a stale group set never lingers there.
  useEffect(() => {
    registerFilters('outreach-page', filterGroups)
    return () => unregisterFilters('outreach-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // Clear the selection whenever the filter/view/archived toggle changes.
  useEffect(() => { setSelectedIds(new Set()) }, [selectedStatus, selectedChannel, selectedOwner, selectedTargetGroup, kpiTargets, view, showArchived, showTrash])

  // Pagination — the table view only; the board shows the whole filtered set
  // (mirrors MatchesPage/TasksPage/OpportunitiesPage's identical split).
  const totalRows = filtered.length
  const lastPage   = Math.max(1, Math.ceil(totalRows / pageSize))
  const paged      = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize])
  // Reset to the first page whenever the filtered set's shape changes.
  useEffect(() => { setPage(1) }, [selectedStatus, selectedChannel, selectedOwner, selectedTargetGroup, kpiTargets, query, showArchived, showTrash]) // eslint-disable-line react-hooks/exhaustive-deps

  // OUTREACH-WISKNOP: same clear-all-filters parity as the other list pages
  // (ClearFiltersButton reports its active state to RightPanelContext, so the
  // topbar filter dot also lights up here) — composes the filter hook's own
  // reset with the two page-owned view toggles.
  const clearAllFilters = () => { filters.clearOwnFilters(); setShowArchived(false); setShowTrash(false) }

  // Kanban drag = a status-only update (optimistic; revert via reload on failure).
  const handleMove = (id: string, status: string) => {
    patch(id, { status })
    updateCampaign(id, { status }).catch(() => { notifyError(t('moveError')); reload() })
  }

  // ── Bulk selection + mutations (active table only) ──
  const toggleRow = (id: string) => setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = (ids: string[], allSelected: boolean) => setSelectedIds((prev) => { const n = new Set(prev); ids.forEach((i) => allSelected ? n.delete(i) : n.add(i)); return n })
  // Bulk set status: optimistic patch + PATCH each (no dedicated bulk endpoint needed).
  const bulkSetStatus = async (status: string) => {
    const ids = [...selectedIds]; if (!ids.length) return
    setSelectedIds(new Set())
    ids.forEach((id) => patch(id, { status }))
    const results = await Promise.allSettled(ids.map((id) => updateCampaign(id, { status })))
    if (results.some((r) => r.status === 'rejected')) { notifyError(t('bulk.mutateError')); reload() }
    else notifySuccess(t('bulk.done', { count: ids.length }))
  }
  // Bulk archive (soft-delete via the per-id DELETE); drop the rows optimistically.
  const bulkArchive = async () => {
    const ids = [...selectedIds]; if (!ids.length) return
    setSelectedIds(new Set())
    ids.forEach((id) => drop(id))
    const results = await Promise.allSettled(ids.map((id) => deleteCampaign(id)))
    if (results.some((r) => r.status === 'rejected')) { notifyError(t('bulk.archiveError')); reload() }
    else notifySuccess(t('bulk.done', { count: ids.length }))
  }

  // Enkelstuks-sweep (BE 9170e40): un-archive ONE campaign via the per-id restore.
  // The response is the fresh detail — prepend it to the active list; the drawer
  // closes (the row leaves the archived view, mirroring candidates/tasks).
  const restoreOne = async (id: string) => {
    try {
      const restored = await restoreCampaign(id)
      removeArchived(id)
      add(restored as Campaign)
      setOpenId(null)
      notifySuccess(t('drawer.archivedBanner.restored'))
    } catch {
      notifyError(t('drawer.archivedBanner.restoreFailed'))
    }
  }

  // The open drawer's row — may live in the active OR the archived list.
  const openRow = openId ? [...campaigns, ...archived].find(c => String(c.id) === String(openId)) : undefined

  // TRASH-OVERAL-2: mark (outreach.delete) / unmark (outreach.update) wiring + the
  // shared preview-modal state; a mark/unmark refetches the soft-deleted list.
  const trash = useTrashFlow({
    entityPath: 'outreach-campaigns',
    onMarked: () => { setOpenId(null); refetchArchived() },
    onUnmarked: () => { setOpenId(null); refetchArchived() },
  })

  return (
    <>
      {/* + Bellijst is a MODAL over the list (Danny 27-07: "geen popup???") —
          the list stays mounted behind it instead of being swapped out. */}
      {creating && <OutreachCreate onClose={() => setCreating(false)} onCreated={add} />}
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Insights strip (donuts + KPIs) */}
          <InsightsRow donuts={insightDonuts} kpis={insightKpis} clearTitle={t('insights.clearFilter')} />

          {/* Toolbar — create on the LEFT, archived toggle + view toggle on the RIGHT (mirror Opportunities) */}
          <OutreachToolbar
            onCreate={handleCreateOpen}
            searchEpoch={filters.searchEpoch}
            onSearch={filters.setQuery}
            anyFilterActive={filters.anyFilterActive}
            onClearFilters={clearAllFilters}
            showArchived={showArchived}
            onToggleArchived={() => { setShowArchived((v) => !v); setShowTrash(false) }}
            showTrash={showTrash}
            onToggleTrash={() => { setShowTrash((v) => !v); setShowArchived(false) }}
            view={view}
            onViewChange={setView}
          />

          {/* Bulk action bar — active table view only, when ≥1 row is selected */}
          {view === 'table' && !showArchived && !showTrash && selectedIds.size > 0 && (
            <div style={{ padding: '8px 24px', flexShrink: 0 }}>
              <OutreachBulkBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}
                onSetStatus={bulkSetStatus} onArchive={bulkArchive} canArchive={canArchive}
                statuses={columns.map((c) => ({ value: c.key, label: c.label, color: c.color }))} />
            </div>
          )}

          {/* Content */}
          {view === 'board' ? (
            <OutreachBoard rows={filtered} columns={columns} onMove={handleMove} />
          ) : (
            <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
              <OutreachList
                campaigns={paged}
                loading={showArchived || showTrash ? archLoading : loading}
                error={showArchived || showTrash ? archError : error}
                onReload={showArchived || showTrash ? refetchArchived : reload}
                emptyText={showArchived || showTrash ? t('archivedEmpty') : undefined}
                selectable={!showArchived && !showTrash}
                selectedIds={selectedIds}
                onToggleRow={toggleRow}
                onToggleAll={toggleAll}
                onOpen={setOpenId}
              />
            </div>
            <PaginationBar page={page} totalPages={lastPage} totalRows={totalRows}
              pageSize={pageSize} onPageChange={setPage} pageSizeOptions={pageSizeOptions}
              onPageSizeChange={n => { setPageSize(n); setPage(1) }} />
            </>
          )}
        </div>
        {/* Per-bellijst drill-down (the call list itself) — row click opens it. An
            archived row feeds the drawer its banner + name/status fallbacks; W2
            delivered (measured: OutreachCampaignController::show is now withTrashed)
            so the drawer fetches the real detail instead of skipping the call. */}
        <OutreachDrawer id={openId} createdAt={openRow?.created_at}
          onClose={() => { setOpenId(null); if (drawerDirtyRef.current) { drawerDirtyRef.current = false; reload() } }}
          // DRILL-REFRESH-AUDIT-1: an owner change patches the row instantly; every
          // other drawer mutation marks the list stale — one reload on close, so a
          // call session of 50 ticks never fires 50 list fetches.
          onMutated={delta => { if (delta?.owner !== undefined && openId) patch(openId, { owner: delta.owner }); else drawerDirtyRef.current = true }}
          archived={Boolean(openRow?.archived)} archivedAt={openRow?.deleted_at ?? null}
          fallbackName={openRow?.name} fallbackStatus={openRow?.status}
          onRestore={canRestore ? restoreOne : undefined}
          // TRASH-OVERAL-2: trash state + mark (outreach.delete) / unmark (outreach.update).
          inTrash={lifecycleOf(openRow) === 'pending_erase'}
          pendingEraseAt={openRow?.pending_erase_at ?? null}
          graceDays={trash.graceDays}
          onMarkDeletion={canMarkDeletion ? (cid) => trash.openFor(cid, openRow?.name ?? String(cid)) : undefined}
          onUnmark={canRestore ? (cid) => trash.unmark(cid) : undefined}
          expanded={drawerExpanded} onToggleExpand={() => setDrawerExpanded(e => !e)} />
      </div>
      {/* TRASH-OVERAL-2: the ONE shared "Definitief verwijderen" preview dialog. */}
      {trash.target && (
        <DeletionPreviewModal open onClose={trash.close} entityLabel={trash.target.label}
          preview={trash.preview} loading={trash.loading} error={trash.error}
          users={[]} onConfirm={trash.confirmMark} busy={trash.busy} blocked={trash.blocked}
          graceDays={trash.graceDays} />
      )}
    </>
  )
}
