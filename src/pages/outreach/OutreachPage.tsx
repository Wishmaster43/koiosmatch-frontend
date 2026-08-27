/**
 * OutreachPage — route page for the call lists ("bellijsten"). Follows the entity
 * blueprint (CLAUDE §3A) and mirrors the Opportunities page: an InsightsRow
 * (donuts + KPIs, click-to-filter), a toolbar with the create button on the LEFT
 * and an archived text-toggle + table/board view toggle on the RIGHT, a bulk bar
 * over the table, and a kanban board. The per-bellijst call-list detail is step 2.
 */
import { useState, useEffect, useMemo, useCallback, type Dispatch, type SetStateAction , useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutList, Kanban, Archive, Plus, Trash2 } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import { useAuth } from '@/context/AuthContext'
import { useRightPanel } from '@/context/RightPanelContext'
import { usePublishSelection } from '@/context/SelectionContext'
import InsightsRow from '@/components/insights/InsightsRow'
import { buildOutreachFilterGroups } from './data/outreachFilterGroups'
import HeaderSearch from '@/components/ui/HeaderSearch'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import ViewModeToggle from '@/components/ui/ViewModeToggle'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import { useDrawerUrl } from '@/hooks/useDrawerUrl'
import { useOpenFromIntent } from '@/context/NavigationContext'
import { usePageMemory } from '@/lib/usePageMemory'
import { useListPageSize } from '@/hooks/useListPageSize'
import { useOutreachCampaigns, OUTREACH_MAX_PER_PAGE } from './hooks/useOutreachCampaigns'
import type { Campaign } from './hooks/useOutreachCampaigns'
import { listCampaigns, updateCampaign, deleteCampaign, restoreCampaign } from './data/outreachApi'
import OutreachList from './OutreachList'
import OutreachBoard from './OutreachBoard'
import OutreachBulkBar from './OutreachBulkBar'
import OutreachCreate from './OutreachCreate'
import OutreachDrawer from './OutreachDrawer'
import PaginationBar from '@/components/ui/PaginationBar'
import DeletionPreviewModal from '@/components/ui/DeletionPreviewModal'
import { useTrashFlow } from '@/hooks/useTrashFlow'
import Button from '@/components/ui/Button'

// Fixed status enum (not a tenant lookup) → board columns, donut + colours (hex for the chart).
/* eslint-disable no-restricted-syntax -- DATA: fixed status/channel colour maps (incl. WhatsApp's real brand green), not UI styling */
const STATUSES = [
  { key: 'draft',  color: '#9CA3AF' },
  { key: 'active', color: '#16A34A' },
  { key: 'done',   color: '#2563EB' },
]
const CHANNELS = [
  { key: 'call',     color: '#2563EB' },
  { key: 'email',    color: '#D97706' },
  { key: 'whatsapp', color: '#25D366' },
]
/* eslint-enable no-restricted-syntax */

const statusKey  = (c: Campaign) => c.status ?? 'draft'
const channelKey = (c: Campaign) => c.channel ?? 'call'
const targetsOf  = (c: Campaign) => c.targets_count ?? c.target_count ?? 0
// Owner name reads defensively — a campaign row may carry either a nested
// object or a flat owner_name field depending on which endpoint populated it.
const ownerNameOf = (c: Campaign) => (c.owner as { name?: string } | null)?.name ?? (c as Record<string, unknown>).owner_name as string | undefined ?? ''
// Target group = the source talent pool the campaign was seeded from. The real
// field (OutreachCampaignResource::toArray) is the flat `pool_name` string —
// confirmed by CMBE 2026-08-13, replacing the earlier tolerant
// pool/from_pool/target_group guesswork that never matched a real API shape.
const targetGroupNameOf = (c: Campaign) => (c as Record<string, unknown>).pool_name as string | undefined ?? ''

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
  // the archived view; both read the same soft-deleted fetch below.
  const [showTrash, setShowTrash] = useState(false)
  const [creating, setCreating] = useState(false)
  // KPI/donut click-to-filter (status) + checkbox selection.
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])
  // Channel filter (second donut) + targets-only KPI toggle.
  const [selectedChannel, setSelectedChannel] = useState<string[]>([])
  const [kpiTargets, setKpiTargets] = useState(false)
  // Right-panel-only filters: owner + target group (source pool).
  const [selectedOwner, setSelectedOwner] = useState<string[]>([])
  const [selectedTargetGroup, setSelectedTargetGroup] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  // KOIOS-SELECTIE-CONTEXT-1: mirror the selection into Koios AI's context chip.
  usePublishSelection('outreach', selectedIds)
  const [query, setQuery] = useState('')  // shared header search (client-side, R-5)

  // Archived campaigns are fetched lazily (only while the archived toggle is on).
  // Mirror the open drawer in the URL (?open=<id>): browser back/forward walks
  // through it and a copied link reopens the same call list (NAV-BACK-1). This
  // KOIOS-RESULT-CARDS-6: calllist result cards target a campaign by id — the
  // cross-entity intent now opens the drawer directly (tab ignored: the outreach
  // drawer has no addressable sub-tabs today).
  useOpenFromIntent(intent, (id) => setOpenId(String(id)))
  useDrawerUrl({ selectedId: openId, openById: (id) => setOpenId(String(id)), close: () => setOpenId(null), intent })

  // OUTREACH-TRASHED-1 fixed (W2 delivered, measured): the BE now takes
  // `?archived=1` as a true onlyTrashed filter (mirrors tasks), so the archived
  // list comes straight from the server — no more client-side subtraction against
  // the active ids, which used to break past the first page.
  const [archivedRaw, setArchivedRaw] = useState<Campaign[]>([])
  const [archLoading, setArchLoading] = useState(false)
  const [archError, setArchError] = useState(false)
  // Bumped after a mark/unmark so the soft-deleted list refetches (TRASH-OVERAL-2).
  const [archTick, setArchTick] = useState(0)
  // Lazily fetch the soft-deleted campaigns only once the archived/trash view is
  // opened; archTick bumps to refetch after a mark/unmark elsewhere on the page.
  useEffect(() => {
    if (!showArchived && !showTrash) return
    let alive = true
    setArchLoading(true); setArchError(false)
    listCampaigns({ archived: 1 })
      .then((res) => { if (alive) setArchivedRaw((res.rows as Campaign[]) ?? []) })
      .catch(() => { if (alive) setArchError(true) })
      .finally(() => { if (alive) setArchLoading(false) })
    return () => { alive = false }
  }, [showArchived, showTrash, archTick])

  // Soft-deleted rows, exactly as the server returned them (each already carries
  // `archived`/`deleted_at`/`lifecycle` from OutreachCampaignResource). Tolerant
  // lifecycle read for payloads that predate the field (TRASH-OVERAL-2).
  const archived = archivedRaw
  const lifecycleOf = (c?: Campaign) => c?.lifecycle ?? (c?.deleted_at || c?.archived ? 'archived' : 'active')

  // Clear the selection whenever the filter/view/archived toggle changes.
  useEffect(() => { setSelectedIds(new Set()) }, [selectedStatus, selectedChannel, selectedOwner, selectedTargetGroup, kpiTargets, view, showArchived, showTrash])

  // Board columns + donut items, labelled via i18n.
  const columns = useMemo(() => STATUSES.map((s) => ({ key: s.key, label: t(`status.${s.key}`), color: s.color })), [t])
  const donutBy = (defs: { key: string; color: string }[], ns: string, keyOf: (c: Campaign) => string) => defs
    .map((d) => ({ name: t(`${ns}.${d.key}`), key: d.key, color: d.color, value: campaigns.filter((c) => keyOf(c) === d.key).length }))
    .filter((d) => d.value > 0)
  // Status donut data, only non-empty buckets, recomputed when the row set or locale changes.
  const statusData  = useMemo(() => donutBy(STATUSES, 'status', statusKey), [campaigns, t]) // eslint-disable-line react-hooks/exhaustive-deps
  const channelData = useMemo(() => donutBy(CHANNELS, 'channel', channelKey), [campaigns, t]) // eslint-disable-line react-hooks/exhaustive-deps

  // Right-panel-only options: owner + target group (source pool), derived from
  // the loaded rows — never a hardcoded list. useCallback-wrapped (stable-setter
  // recipe, mirrors CandidatesPage/CustomersPage/VacanciesPage) so the two memos
  // below can list the real dependency (`optionsFrom`) instead of dropping it.
  const optionsFrom = useCallback((nameOf: (c: Campaign) => string): { value: string; label: string; count: number }[] => {
    const m = new Map<string, number>()
    campaigns.forEach((c) => { const n = nameOf(c); if (n) m.set(n, (m.get(n) ?? 0) + 1) })
    return [...m.entries()].map(([value, count]) => ({ value, label: value, count }))
  }, [campaigns])
  // Owner filter options, derived from the loaded campaigns (never hardcoded).
  const ownerOptions = useMemo(() => optionsFrom(ownerNameOf), [optionsFrom])
  const targetGroupOptions = useMemo(() => optionsFrom(targetGroupNameOf), [optionsFrom])

  // Register the right-panel filters (status/channel/owner/target-group/archived).
  const filterGroups = useMemo(() => buildOutreachFilterGroups({
    t, tog,
    selectedStatus, setSelectedStatus, selectedChannel, setSelectedChannel,
    selectedOwner, setSelectedOwner, selectedTargetGroup, setSelectedTargetGroup,
    showArchived, setShowArchived,
    statusOptions: statusData.map(d => ({ value: d.key, label: d.name, count: d.value })),
    channelOptions: channelData.map(d => ({ value: d.key, label: d.name, count: d.value })),
    ownerOptions, targetGroupOptions,
  }), [t, selectedStatus, selectedChannel, selectedOwner, selectedTargetGroup, showArchived, statusData, channelData, ownerOptions, targetGroupOptions])

  // Publish the current filter groups into the shared right panel; unregister on
  // unmount/change so a stale group set never lingers there.
  useEffect(() => {
    registerFilters('outreach-page', filterGroups)
    return () => unregisterFilters('outreach-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // Base rows per lifecycle view (TRASH-OVERAL-2, mirrors candidates): trash =
  // pending_erase only, archived = archived only, default = the active list.
  const baseRows = showTrash
    ? archived.filter((c) => lifecycleOf(c) === 'pending_erase')
    : showArchived
      ? archived.filter((c) => lifecycleOf(c) === 'archived')
      : campaigns
  // Status filter (from the donut/KPI) narrows both the table and the board.
  const filtered = useMemo(() => {
    let byStatus = selectedStatus.length ? baseRows.filter((c) => selectedStatus.includes(statusKey(c))) : baseRows
    if (selectedChannel.length) byStatus = byStatus.filter((c) => selectedChannel.includes(channelKey(c)))
    if (selectedOwner.length) byStatus = byStatus.filter((c) => selectedOwner.includes(ownerNameOf(c)))
    if (selectedTargetGroup.length) byStatus = byStatus.filter((c) => selectedTargetGroup.includes(targetGroupNameOf(c)))
    if (kpiTargets) byStatus = byStatus.filter((c) => targetsOf(c) > 0)
    if (!query.trim()) return byStatus
    const q = query.trim().toLowerCase()
    return byStatus.filter((c) => `${(c as { name?: string }).name ?? ''}`.toLowerCase().includes(q))
  }, [baseRows, selectedStatus, selectedChannel, selectedOwner, selectedTargetGroup, kpiTargets, query])

  // Pagination — the table view only; the board shows the whole filtered set
  // (mirrors MatchesPage/TasksPage/OpportunitiesPage's identical split).
  const totalRows = filtered.length
  const lastPage   = Math.max(1, Math.ceil(totalRows / pageSize))
  const paged      = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize])
  // Reset to the first page whenever the filtered set's shape changes.
  useEffect(() => { setPage(1) }, [selectedStatus, selectedChannel, selectedOwner, selectedTargetGroup, kpiTargets, query, showArchived, showTrash]) // eslint-disable-line react-hooks/exhaustive-deps

  // OUTREACH-WISKNOP: same clear-all-filters parity as the other list pages
  // (ClearFiltersButton reports its active state to RightPanelContext, so the
  // topbar filter dot also lights up here) — every filter dimension this page
  // owns, mirrored from useApplicationFilters' anyFilterActive/clearAllFilters.
  const anyFilterActive = Boolean(query.trim() || selectedStatus.length || selectedChannel.length
    || selectedOwner.length || selectedTargetGroup.length || kpiTargets || showArchived || showTrash)
  // Remount the (self-stateful) search input on clear so the visible text resets too.
  const [searchEpoch, setSearchEpoch] = useState(0)
  // "Clear all filters" button: resets every filter dimension this page owns, and
  // bumps searchEpoch so the (self-stateful) search input's visible text resets too.
  const clearAllFilters = () => {
    setSearchEpoch(e => e + 1); setQuery(''); setSelectedStatus([]); setSelectedChannel([])
    setSelectedOwner([]); setSelectedTargetGroup([]); setKpiTargets(false); setShowArchived(false); setShowTrash(false)
  }

  // Donut/KPI click = set exactly one status value (or clear when clicked again).
  const pickStatus  = (v?: string) => { if (v != null) setSelectedStatus((p) => (p.length === 1 && p[0] === v) ? [] : [v]) }
  const pickChannel = (v?: string) => { if (v != null) setSelectedChannel((p) => (p.length === 1 && p[0] === v) ? [] : [v]) }

  // ── Insights: 2 donuts (status/channel, filterable) + 3 KPI cards ──
  const insightDonuts: DonutSpec[] = [
    { key: 'status',  title: t('insights.status'),  data: statusData,  onPick: (d) => pickStatus((d as { key?: string })?.key), active: selectedStatus.length > 0, onClear: () => setSelectedStatus([]) },
    { key: 'channel', title: t('insights.channel'), data: channelData, onPick: (d) => pickChannel((d as { key?: string })?.key), active: selectedChannel.length > 0, onClear: () => setSelectedChannel([]) },
  ]
  const insightKpis: KpiSpec[] = [
    { key: 'total',   label: t('kpi.total'),   value: campaigns.length,                                          sub: t('kpi.totalSub'),
      onClick: () => { setSelectedStatus([]); setSelectedChannel([]); setKpiTargets(false) },
      // Reset-to-all tile — clickable, but never highlighted (no filter = nothing active).
      active: false },
    { key: 'active',  label: t('kpi.active'),  value: campaigns.filter((c) => statusKey(c) === 'active').length, sub: t('kpi.activeSub'), color: 'var(--color-success-text)',
      onClick: () => pickStatus('active'), active: selectedStatus.length === 1 && selectedStatus[0] === 'active' },
    { key: 'targets', label: t('kpi.targets'), value: campaigns.reduce((n, c) => n + targetsOf(c), 0),           sub: t('kpi.targetsSub'), color: 'var(--color-primary-text)',
      onClick: () => setKpiTargets(v => !v), active: kpiTargets },
  ]

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
      setArchivedRaw((prev) => prev.filter((c) => c.id !== id))
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
    onMarked: () => { setOpenId(null); setArchTick(v => v + 1) },
    onUnmarked: () => { setOpenId(null); setArchTick(v => v + 1) },
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 24px 12px', minHeight: 36, flexShrink: 0 }}>
            {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
            <Button variant="primary" size="md" onClick={() => setCreating(true)}>
              <Plus size={15} /> {t('new')}
            </Button>
            <HeaderSearch key={searchEpoch} onSearch={setQuery} placeholder={t('page.searchPlaceholder')} width={280} />
            <ClearFiltersButton active={anyFilterActive} onClear={clearAllFilters} />

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Archived (soft-deleted) — shared quick-view toggle (§4); exclusive
                  with the trash view below (TRASH-OVERAL-2, mirrors candidates). */}
              <QuickViewToggle active={showArchived} onToggle={() => { setShowArchived((v) => !v); setShowTrash(false) }}
                label={t('view.archived')} color="var(--color-archive)" icon={Archive} />
              {/* Prullenbak (pending erase) — same shared toggle, candidates' trash colour. */}
              <QuickViewToggle active={showTrash} onToggle={() => { setShowTrash((v) => !v); setShowArchived(false) }}
                label={t('common:trash.view')} color="var(--color-trash)" icon={Trash2} />
              {/* Table / board view toggle — shared ViewModeToggle (§4, audit r5: this was
                  the last hand-rolled solid-fill switcher after MatchesPage/TasksPage/
                  ApplicationsPage moved to the shared component). */}
              <ViewModeToggle value={view} onChange={setView} options={[
                { id: 'table', icon: LayoutList, label: t('view.table') },
                { id: 'board', icon: Kanban, label: t('view.board') },
              ]} />
            </div>
          </div>

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
                onReload={showArchived || showTrash ? () => setArchTick(v => v + 1) : reload}
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
