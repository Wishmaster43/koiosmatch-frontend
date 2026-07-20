import { useState, useEffect, useMemo, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, LayoutList, Kanban, Archive } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useRightPanel } from '@/context/RightPanelContext'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { notify } from '@/lib/notify'
import { isReferenceQuery } from '@/lib/referenceNumber'
import InsightsRow from '@/components/insights/InsightsRow'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import MatchesTable from './MatchesTable'
import MatchesBoard from './MatchesBoard'
import type { BoardColumn } from './MatchesBoard'
import MatchDrawer from './MatchDrawer'
import { usePageMemory } from '@/lib/usePageMemory'
import MatchesBulkBar from './MatchesBulkBar'
// The full placement form (§3B "direct match" path) — shared with the candidate
// drawer; without a fixed candidateId it shows its own candidate picker.
import MatchPlacementModal from '@/pages/candidates/drawer/MatchPlacementModal'
import PaginationBar from '@/components/ui/PaginationBar'
import ViewSwitch from '@/components/ui/ViewSwitch'
import HeaderSearch from '@/components/ui/HeaderSearch'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import { useOpenFromIntent } from '@/context/NavigationContext'
import { useDrawerUrl } from '@/hooks/useDrawerUrl'
import { useMatches, mapMatch } from './hooks/useMatches'
import { useMatchesBulkActions } from './hooks/useMatchesBulkActions'
import { useMatchArchive } from './hooks/useMatchArchive'
import { BTN_H } from '@/config/buttonMetrics'
import type { MatchRow } from '@/types/match'
import type { Id } from '@/types/common'

// MatchesPage — loads matches, shows an insights strip and paginates the table.
export default function MatchesPage({ intent }: { intent?: unknown } = {}) {
  const { t } = useTranslation('matches')
  const auth = useAuth()
  const user = auth?.user
  // Coupling is authorization-gated in the UI; the backend re-checks (§7).
  const hasPermission = auth?.hasPermission ?? (() => false)
  const [query,       setQuery]       = usePageMemory('matches.search', '')
  // NUMMER-1: a typed reference number (M-00042) narrows the fetch server-side to
  // an exact `?ref=` lookup instead of the client-side free-text filter below.
  const trimmedQuery = query.trim()
  const refQuery = isReferenceQuery(trimmedQuery) ? trimmedQuery : null
  // MATCH-ARCHIVED-LIST-1: reveal soft-deleted matches alongside the active set.
  const [showArchived, setShowArchived] = usePageMemory('matches.archived', false)
  // Data (fetch + mapping) lives in the hook (§3); the page only derives + renders.
  const { rows, loading, error, updateMatch, reload } = useMatches(refQuery, showArchived)
  const { registerFilters, unregisterFilters } = useRightPanel()
  // Match statuses drive the board columns + donut (R-1b lookup; the funnel is
  // an APPLICATION axis — the match resource no longer carries a stage).
  const { statuses: matchStatuses, metaOf: matchStatusMeta } = useMatchStatuses()
  const [page,        setPage]        = useState(1)
  const [pageSize,    setPageSize]    = useState(() => user?.default_per_page ?? 50)
  const [stageFilter, setStageFilter] = usePageMemory<string[]>('matches.stage', [])
  // KPI attention toggle (Gem. score → only scored matches).
  const [kpiScored, setKpiScored] = usePageMemory('matches.scored', false)
  const [ownerFilter, setOwnerFilter] = usePageMemory<string[]>('matches.owner', [])
  const [clientFilter, setClientFilter] = usePageMemory<string[]>('matches.client', [])
  // Start of the current month, captured once (purity — feeds the "Nieuw" KPI).
  const [monthStart] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime() })
  // Bulk selection (checkboxes); accumulates across pages, clears on filter change.
  const [selectedIds, setSelectedIds] = useState<Set<Id>>(() => new Set())
  const { toggleRow, toggleAll, bulkCoupleHelloFlex, bulkCoupleShiftManager } =
    useMatchesBulkActions({ selectedIds, setSelectedIds, t })

  // Donut click: toggle one value (second click clears).
  const pickOne = (set: Dispatch<SetStateAction<string[]>>) => (d: unknown) => {
    const dd = d as { key?: string; payload?: { key?: string }; name?: string }
    const v = dd?.key ?? dd?.payload?.key ?? dd?.name
    if (v != null) set(p => (p.length === 1 && p[0] === v) ? [] : [v])
  }

  // Aggregate status data for the donut (label/colour from the lookup).
  const stageData = useMemo(() => {
    const m: Record<string, { name: string; key: string; color?: string; value: number }> = {}
    rows.forEach(r => {
      if (!r.status) return
      const meta = matchStatusMeta(r.status)
      ;(m[r.status] ??= { name: meta?.label ?? r.status, key: r.status, color: meta?.color, value: 0 }).value++
    })
    return Object.values(m)
  }, [rows, matchStatusMeta])

  const ownerData = useMemo(() => {
    // No explicit colour: the donut assigns its palette per owner (one grey for ALL
    // owners was the bug — a hardcoded colour suppresses the palette fallback).
    const m: Record<string, { name: string; key: string; value: number }> = {}
    rows.forEach(r => { if (r.owner) (m[r.owner] ??= { name: r.owner, key: r.owner, value: 0 }).value++ })
    return Object.values(m)
  }, [rows])

  // Client distribution (3rd donut) — palette per client (Danny: 9 KPIs everywhere).
  const clientData = useMemo(() => {
    const m: Record<string, { name: string; key: string; value: number }> = {}
    rows.forEach(r => { if (r.client && r.client !== '—') (m[r.client] ??= { name: r.client, key: r.client, value: 0 }).value++ })
    return Object.values(m)
  }, [rows])

  // Multi-select toggle for the right-panel filter groups (add/remove a value).
  const tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string | number) =>
    set(p => p.includes(String(v)) ? p.filter(x => x !== String(v)) : [...p, String(v)])

  // Right-panel filters: status (stage) + owner. The same stageFilter/ownerFilter
  // drive the donuts, so both stay in sync. (Archived lives in the toolbar segment.)
  const filterGroups = useMemo(() => [
    { key: 'stage', label: t('filters.status'), selected: stageFilter,
      options: stageData.map(d => ({ value: d.key, label: d.name, count: d.value })),
      onToggle: tog(setStageFilter) },
    { key: 'owner', label: t('filters.owner'), selected: ownerFilter,
      options: ownerData.map(d => ({ value: d.key, label: d.name, count: d.value })),
      onToggle: tog(setOwnerFilter) },
    { key: 'client', label: t('insights.client'), selected: clientFilter,
      options: clientData.map(d => ({ value: d.key, label: d.name, count: d.value })),
      onToggle: tog(setClientFilter) },
  ], [t, stageFilter, ownerFilter, clientFilter, stageData, ownerData, clientData])

  // Register/unregister the filters in the right panel.
  useEffect(() => {
    registerFilters('matches-page', filterGroups)
    return () => unregisterFilters('matches-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // Reset to the first page and clear the selection whenever a filter changes
  // (kept out of the memo — setting state during render can loop).
  useEffect(() => { setPage(1); setSelectedIds(new Set()) }, [stageFilter, ownerFilter, kpiScored, query, showArchived])

  // Filter the visible rows by donut selection. A reference-number query already
  // narrowed `rows` server-side (exact `?ref=` lookup) — skip the free-text
  // re-filter so the single matched row isn't accidentally filtered back out.
  const filteredAll = useMemo(() => {
    const q = refQuery ? '' : query.trim().toLowerCase()
    return rows.filter(r => {
      if (stageFilter.length && !stageFilter.includes(r.status)) return false
      if (kpiScored && typeof r.score !== 'number') return false
      if (ownerFilter.length && !ownerFilter.includes(r.owner)) return false
      if (clientFilter.length && !clientFilter.includes(r.client)) return false
      if (q && ![r.candidate, r.vacancy, r.client].some(v => String(v ?? '').toLowerCase().includes(q))) return false
      return true
    })
  }, [rows, stageFilter, ownerFilter, clientFilter, kpiScored, query, refQuery])

  // Board rows never include archived matches: dragging one to a new status would
  // PATCH /matches/{id}, which 404s once soft-deleted (MatchController::update has
  // no withTrashed()) — the archived-mixed view is table-only, mirrors the meta
  // picker/approval actions the drawer already hides for an archived match.
  const boardRows = useMemo(() => filteredAll.filter(r => !r.archived), [filteredAll])

  const totalRows = filteredAll.length
  const lastPage  = Math.max(1, Math.ceil(totalRows / pageSize))
  const paged     = useMemo(() => filteredAll.slice((page - 1) * pageSize, page * pageSize), [filteredAll, page, pageSize])

  // KPI: open vs closed via the is_closed FLAG (never the slug — R-1b).
  const isClosed    = (r: MatchRow) => Boolean(matchStatusMeta(r.status)?.is_closed)
  const activeCount = rows.filter(r => !isClosed(r)).length
  const closedCount = rows.filter(isClosed).length
  const avgScore    = rows.length ? Math.round(rows.reduce((s, r) => s + (r.score ?? 0), 0) / rows.length) : null
  // New this month + matches still lacking a score (both derived from the rows).
  const newThisMonthCount = rows.filter(r => r.date && new Date(r.date).getTime() >= monthStart).length
  const unscoredCount     = rows.filter(r => typeof r.score !== 'number').length

  // Donuts drive the stage/owner filters; each clears its own selection.
  const insightDonuts: DonutSpec[] = [
    { key: 'stage', title: t('insights.status'), data: stageData, onPick: pickOne(setStageFilter),
      active: stageFilter.length > 0, onClear: () => setStageFilter([]) },
    { key: 'owner', title: t('insights.owner'), data: ownerData, onPick: pickOne(setOwnerFilter),
      active: ownerFilter.length > 0, onClear: () => setOwnerFilter([]) },
    { key: 'client', title: t('insights.client'), data: clientData, onPick: pickOne(setClientFilter),
      active: clientFilter.length > 0, onClear: () => setClientFilter([]) },
  ]

  // Shared clear-all (page memory keeps filters sticky).
  const anyFilterActive = Boolean(query.trim() || kpiScored || stageFilter.length || ownerFilter.length || clientFilter.length || showArchived)
  const [searchEpoch, setSearchEpoch] = useState(0)
  const clearAllFilters = () => {
    setSearchEpoch(e => e + 1); setQuery(''); setKpiScored(false)
    setStageFilter([]); setOwnerFilter([]); setClientFilter([]); setShowArchived(false)
  }

  // KPI clicks drive the existing stage filter (chip + clear come for free);
  // clicking the active card again clears (mirror of the kansen cards).
  const eqSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|')
  const activeStages = [...new Set(rows.filter(r => !isClosed(r)).map(r => r.status).filter(Boolean))]
  const closedStages = [...new Set(rows.filter(isClosed).map(r => r.status).filter(Boolean))]
  const toggleStages = (labels: string[]) => { if (labels.length) setStageFilter(p => (eqSet(p, labels) ? [] : labels)) }
  const insightKpis: KpiSpec[] = [
    // Totaal is the neutral card: clicking clears, but it never shows as "aan"
    // (the default highlight read as an active filter — Danny 2026-07-06).
    { key: 'total',    label: t('kpi.total'),    value: rows.length, color: 'var(--color-primary)',
      onClick: () => { setStageFilter([]); setOwnerFilter([]); setKpiScored(false) } },
    { key: 'active',   label: t('kpi.active'),   value: activeCount, color: 'var(--color-primary)',
      onClick: () => toggleStages(activeStages), active: stageFilter.length > 0 && eqSet(stageFilter, activeStages) },
    { key: 'closed',   label: t('kpi.closed'),   value: closedCount, color: 'var(--color-success)',
      onClick: () => toggleStages(closedStages), active: stageFilter.length > 0 && eqSet(stageFilter, closedStages) },
    { key: 'newThisMonth', label: t('kpi.newThisMonth'), value: newThisMonthCount, color: 'var(--color-primary)',
      onClick: () => { setStageFilter([]); setOwnerFilter([]); setClientFilter([]); setKpiScored(false) } },
    { key: 'unscored', label: t('kpi.unscored'), value: unscoredCount, color: 'var(--color-warning)',
      onClick: () => setKpiScored(false) },
    { key: 'avgScore', label: t('kpi.avgScore'), value: avgScore != null ? `${avgScore}%` : '—', color: 'var(--color-primary)',
      onClick: () => setKpiScored(v => !v), active: kpiScored },
  ]

  // Direct-match creation modal (§3B "direct match" path).
  const [addOpen, setAddOpen] = useState(false)
  // Read-only drill-down: the clicked row opens the MatchDrawer beside the table.
  const [selected, setSelected] = useState<MatchRow | null>(null)
  // Cross-entity open ({ open: id }): the drawer needs the ROW, so park the id until
  // the rows are loaded, then select the matching one (candidate drawer → match).
  const [pendingOpenId, setPendingOpenId] = useState<Id | null>(null)
  // Guards the one-shot direct fetch for a deep-link open (see effect below).
  const fetchingOpenRef = useRef<string | null>(null)
  useOpenFromIntent(intent, (id) => setPendingOpenId(id))
  useEffect(() => {
    if (pendingOpenId == null) return
    const row = rows.find(r => String(r.id) === String(pendingOpenId))
    if (row) { setSelected(row); setPendingOpenId(null); return }
    // Deep-link fallback (Danny 20-07: match-link 'deed niets'): the target may not
    // be in the loaded page (pagination/filters) — fetch it directly, like the
    // candidates/vacancies openById paths, instead of silently dropping the open.
    if (loading || fetchingOpenRef.current === String(pendingOpenId)) return
    fetchingOpenRef.current = String(pendingOpenId)
    api.get(`/matches/${pendingOpenId}`, { params: { include_archived: 1 } })
      .then(r => { setSelected(mapMatch(unwrap(r))); setPendingOpenId(null) })
      .catch(() => { notifyError(t('page.openNotFound')); setPendingOpenId(null) })
      .finally(() => { fetchingOpenRef.current = null })
  }, [pendingOpenId, rows, loading])
  // Mirror the open drawer in the URL (?open=<id>): browser back/forward walks
  // through it and a copied link reopens the same match (NAV-BACK-1). Reuses the
  // existing pendingOpenId deferral above instead of a second lookup mechanism.
  useDrawerUrl({ selectedId: selected?.id, openById: setPendingOpenId, close: () => setSelected(null), intent })
  const [drawerExpanded, setDrawerExpanded] = useState(false)
  // Shared row-patch: optimistic list update + keep the open drawer's copy in
  // sync. Reused by the approval workflow AND the contract/financial edit (both
  // just patch fields on the same row — no need for two persistence paths).
  const patchRow = (id: MatchRow['id'], patch: Partial<MatchRow>) => {
    updateMatch(id, patch)
    setSelected(p => (p && p.id === id ? { ...p, ...patch } : p))
  }

  // ARCHIVE-1: per-id archive/restore (enkelstuks-sweep, BE 9170e40) — gated on
  // matches.update, the same permission the DELETE/restore routes themselves require.
  const { archiveMatch, restoreMatch } = useMatchArchive({ onPatch: patchRow, onReload: reload })
  const canArchive = hasPermission('matches.update')

  // View toggle: table ⇄ board (planboard). Board columns = the tenant match
  // statuses (R-1b lookup + seed fallback) so there are always columns to drag.
  const [view, setView] = usePageMemory<'table' | 'board'>('matches.view', 'table')
  // Scroll container for row virtualization — DataTable virtualizes against it.
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const stageColumns: BoardColumn[] = useMemo(
    () => matchStatuses.map(st => ({ key: st.value, label: st.label, color: st.color ?? '#6B7280' })), [matchStatuses])

  // Drag a card to another column → change the match's STATUS (optimistic + persist;
  // the is_closed flag server-side ends the match when applicable).
  const handleMove = (id: Id, statusKey: string) => {
    updateMatch(id, { status: statusKey })
    setSelected(p => (p && p.id === id ? { ...p, status: statusKey } : p))
    api.patch(`/matches/${id}`, { status: statusKey }).catch(() => notify('error', t('bulk.mutateError')))
  }

  // Save the Extra tab's tenant custom fields (§3B); optimistic + PATCH, merging the
  // partial patch into the full map so the backend persists it whole (patchRow only
  // syncs local state — the actual PATCH lives here, mirroring handleMove above).
  const handleUpdateCustomFields = (id: MatchRow['id'], patch: Record<string, unknown>) => {
    const merged = { ...(selected?.customFieldValues ?? {}), ...patch }
    patchRow(id, { customFieldValues: merged })
    api.patch(`/matches/${id}`, { custom_fields: merged }).catch(() => notify('error', t('bulk.mutateError')))
  }

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* Table area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Insights strip — donuts + KPI cards */}
      <InsightsRow
        donuts={insightDonuts}
        kpis={insightKpis}
        clearTitle={t('insights.clearFilter')}
      />

      {/* Toolbar — bulk bar or add button (left) + segmented view/archive selector (right) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 24px 12px', flexShrink: 0, minHeight: 36 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          {selectedIds.size > 0 ? (
            <MatchesBulkBar
              count={selectedIds.size}
              onClear={() => setSelectedIds(new Set())}
              onCoupleHelloFlex={bulkCoupleHelloFlex}
              onCoupleShiftManager={bulkCoupleShiftManager}
              canCouple={hasPermission('matches.couple')}
            />
          ) : (
            // Create a direct match (candidate + vacancy) from the Matches page.
            // BTN_H (§4/§9): one explicit height for every text/action button, everywhere.
            <button
              onClick={() => setAddOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 14px', fontSize: 13,
                fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'var(--color-primary)', color: '#fff' }}>
              <Plus size={15} aria-hidden="true" /> {t('add.button')}
            </button>
          )}
          {/* Shared search — mirror the other list pages (§3A). */}
          <HeaderSearch key={searchEpoch} onSearch={setQuery} placeholder={t('page.searchPlaceholder')} width={260} />
            <ClearFiltersButton active={anyFilterActive} onClear={clearAllFilters} />
        </div>

        {/* Right — archived toggle + icon-only view toggle (mirror vacancies/opportunities). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Archived (soft-deleted) — shared quick-view toggle (§4); reveals rows
              alongside the active set (MatchesTable renders the "Gearchiveerd" chip). */}
          <QuickViewToggle active={showArchived} onToggle={() => setShowArchived(v => !v)}
            label={t('view.archived')} color="var(--color-archive)" icon={Archive} />
          {/* View toggle — icon-only (label as aria-label + tooltip, §6) */}
          <button onClick={() => setView('table')} title={t('view.matches')} aria-label={t('view.matches')}
            style={{ display: 'flex', padding: 6, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer',
              background: view === 'table' ? 'var(--color-primary)' : 'var(--surface)', color: view === 'table' ? '#fff' : 'var(--text)' }}>
            <LayoutList size={16} aria-hidden="true" />
          </button>
          <button onClick={() => setView('board')} title={t('view.board')} aria-label={t('view.board')}
            style={{ display: 'flex', padding: 6, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer',
              background: view === 'board' ? 'var(--color-primary)' : 'var(--surface)', color: view === 'board' ? '#fff' : 'var(--text)' }}>
            <Kanban size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Table ⇄ board — ViewSwitch keeps both mounted (display toggle, not
          unmount) so the table's virtualizer never remeasures 0 on returning from
          the board (§ViewSwitch); row virtualization is now safe to enable. */}
      <ViewSwitch active={view} views={[
        {
          id: 'table',
          render: () => (
            <>
              <div ref={tableScrollRef} style={{ flex: 1, overflow: 'auto', padding: '0 24px 16px' }}>
                <MatchesTable rows={paged} loading={loading} error={error} stickyHeader scrollParentRef={tableScrollRef}
                  onRowClick={setSelected} selectedId={selected?.id}
                  selectable selectedIds={selectedIds} onToggleRow={toggleRow} onToggleAll={toggleAll} />
              </div>

              <PaginationBar page={page} totalPages={lastPage} totalRows={totalRows}
                pageSize={pageSize} onPageChange={setPage}
                onPageSizeChange={n => { setPageSize(n); setPage(1) }} />
            </>
          ),
        },
        {
          id: 'board',
          render: () => (
            <MatchesBoard rows={boardRows} columns={stageColumns} onMove={handleMove}
              onSelect={setSelected} selectedId={selected?.id} />
          ),
        },
      ]} />
      </div>

      {/* Read-only drill-down drawer */}
      <MatchDrawer match={selected} onClose={() => setSelected(null)}
        expanded={drawerExpanded} onToggleExpand={() => setDrawerExpanded(v => !v)}
        onSetStatus={(status) => {
          if (!selected?.id) return
          updateMatch(selected.id, { status }); setSelected(p => (p ? { ...p, status } : p))
          api.patch(`/matches/${selected.id}`, { status }).catch(() => notify('error', t('bulk.mutateError')))
        }}
        // Approval workflow (§7 — UI-only gate; the backend re-checks matches.update).
        canApprove={hasPermission('matches.update')}
        onApprovalChange={patchRow}
        onUpdate={patchRow}
        onUpdateCustomFields={handleUpdateCustomFields}
        // ARCHIVE-1: per-id delete/restore (§7 — UI-only gate; the backend re-checks
        // matches.update on both routes).
        onArchive={canArchive ? archiveMatch : undefined}
        onRestore={canArchive ? restoreMatch : undefined} />

      {/* Direct-match creation: the full placement form (rate proposal, contract,
          cost center) with a candidate picker; refetch so server-derived fields land. */}
      {addOpen && <MatchPlacementModal onClose={() => setAddOpen(false)} onCreated={reload} />}
    </div>
  )
}
