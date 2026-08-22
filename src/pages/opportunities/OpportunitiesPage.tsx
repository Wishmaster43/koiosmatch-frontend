import { useState, useEffect, useMemo, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutList, Kanban, Archive, Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useRightPanel } from '@/context/RightPanelContext'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
import { useBranchOptions } from '@/lib/useBranchOptions'
import OpportunitiesInsightsRow from './OpportunitiesInsightsRow'
import HeaderSearch from '@/components/ui/HeaderSearch'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import ViewSwitch from '@/components/ui/ViewSwitch'
import ViewModeToggle from '@/components/ui/ViewModeToggle'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import OpportunitiesTable from './OpportunitiesTable'
import OpportunitiesBoard from './OpportunitiesBoard'
import OpportunityDrawer from './OpportunityDrawer'
import AddOpportunityModal from './AddOpportunityModal'
import PaginationBar from '@/components/ui/PaginationBar'
import { useOpportunitiesData, OPPORTUNITIES_MAX_PER_PAGE } from './hooks/useOpportunitiesData'
import { useOpportunityArchive } from './hooks/useOpportunityArchive'
import { useDrawerUrl } from '@/hooks/useDrawerUrl'
import { usePageMemory } from '@/lib/usePageMemory'
import { useListPageSize } from '@/hooks/useListPageSize'
import { isReferenceQuery } from '@/lib/referenceNumber'
import { buildOpportunityFilterGroups } from './data/opportunityFilterGroups'
import Button from '@/components/ui/Button'

// Single-select donut pick: clicking the active segment clears it.
const pickOne = (set: Dispatch<SetStateAction<string[]>>) => (d: unknown) => {
  const o = d as { key?: string; name?: string; payload?: { key?: string } } | null | undefined
  const v = o?.key ?? o?.payload?.key ?? o?.name
  if (v != null) set(p => (p.length === 1 && p[0] === v) ? [] : [v])
}

// Right-panel multi-toggle for a filter dimension.
const tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string) =>
  set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])

// OpportunitiesPage — thin container: the data layer (load + mutations) lives in
// useOpportunitiesData; the page only derives the filtered/paged view and renders.
export default function OpportunitiesPage({ intent }: { intent?: unknown } = {}) {
  const { t } = useTranslation(['opportunities', 'common'])
  // Scroll container for row virtualization (F-11): DataTable virtualizes against it.
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const auth = useAuth()
  // Archive/restore is authorization-gated in the UI; the backend re-checks (§7).
  const hasPermission = auth?.hasPermission ?? (() => false)
  const { registerFilters, unregisterFilters } = useRightPanel()
  // Tenant setting: show the deal magnitude in hours instead of euro (Settings → Kansen).
  const valueInHours = getBoolSetting(useAllSettings(), 'opportunity_value_in_hours', false)
  // ARCHIVE-1: the archived quick-view (TRASH-OVERAL-2: now an ISOLATED
  // lifecycle==='archived' view — mirrors candidates; include_archived returns
  // only soft-deleted rows since TRASH-OVERAL-1b, so "alongside" is history).
  const [showArchived, setShowArchived] = usePageMemory('opps.archived', false)
  // TRASH-OVERAL-2: Prullenbak view (lifecycle pending_erase) — same include_archived
  // request, split client-side; mutually exclusive with the archived view.
  const [showTrash, setShowTrash] = usePageMemory('opps.trash', false)
  // VESTIGING-2: explicit branch filter (inherited from the customer) — a
  // narrowing only; the server excludes deals with no branch, see the empty-state
  // notice below. Values limited to the user's own branch scope (`[]` = unrestricted,
  // auth/me.branch_ids, COORDINATION-LOG 28-07).
  const [selectedBranch, setSelectedBranch] = usePageMemory<string[]>('opps.branch', [])
  const branchOptions = useBranchOptions()

  // Shared header search (free text stays client-side, R-5). Declared before the data
  // hook because a reference-number query has to reach it. NUMMER-1: a typed number
  // (KA-00042) flips the search to an exact server-side `?ref=` lookup — same shared
  // detector as candidates/customers/vacancies/matches, never a second regex.
  const [query, setQuery] = usePageMemory('opps.search', '')
  const refQuery = isReferenceQuery(query.trim()) ? query.trim() : null

  // Data layer (§3): list + customers + selection + optimistic mutations.
  const {
    rows, loading, error, customers, users, stages,
    selected, drawerExpanded, setDrawerExpanded,
    selectedIds, toggleRow, toggleAll, clearSelection,
    selectOpportunity, closeDrawer, handleCreated, handleMove, updateOpportunity, reload,
  } = useOpportunitiesData(showArchived || showTrash, selectedBranch, refQuery)

  // ARCHIVE-1: per-id archive/restore (routes pre-date this sweep; see the hook's
  // own comment). Gated on the SAME permission each route requires server-side —
  // opportunities.delete for the trash icon, opportunities.update for restore.
  const { archiveOpportunity, restoreOpportunity, dialog: archiveConfirmDialog } = useOpportunityArchive({ onPatch: updateOpportunity, onReload: reload })

  // Mirror the open drawer in the URL (?open=<id>): browser back/forward walks
  // through it and a copied link reopens the same opportunity (NAV-BACK-1 —
  // Danny: "back knop vanuit kans → taak en dan back kom ik niet terug waar ik was").
  useDrawerUrl({ selectedId: selected?.id, openById: (id) => selectOpportunity({ id } as Parameters<typeof selectOpportunity>[0]), close: closeDrawer, intent })

  const [view,     setView]     = usePageMemory('opps.view', 'table')  // 'table' | 'board'
  const [page,     setPage]     = usePageMemory('opps.page', 1)
  // Shared page-size hook (§ audit 2026-08-05): seeds from user.default_per_page,
  // clamps to OpportunityQuery's real per_page ceiling (200) and stays sticky
  // across the shell's unmount-on-navigate — mirrors every other list page.
  const { pageSize, setPageSize, options: pageSizeOptions } = useListPageSize('opps', OPPORTUNITIES_MAX_PER_PAGE)
  const [stage,    setStage]    = usePageMemory<string[]>('opps.stage', []) // selected stage labels (donut + panel)
  const [owner,    setOwner]    = usePageMemory<string[]>('opps.owner', []) // selected owner names (donut + panel)
  const [client,   setClient]   = usePageMemory<string[]>('opps.client', []) // selected client names (panel)
  const [addOpen,  setAddOpen]  = useState(false)

  // "Aflopend" quick-filter (dashboard KPI). Definition MIRRORS the backend's
  // expiring_opps exactly (DashboardService): close date TODAY t/m +14 dagen,
  // date-granular — anders wijkt de lijst af van het KPI-getal (Danny: "1 vs 3").
  // Reference moment captured once per mount (purity rule — mirrors convCutoff).
  const [expiringOnly, setExpiringOnly] = useState(false)
  const [dayStart] = useState(() => new Date(new Date().setHours(0, 0, 0, 0)).getTime())
  // Shared clear-all (page memory keeps filters sticky).
  const anyFilterActive = Boolean(query.trim() || stage.length || owner.length || client.length || selectedBranch.length || expiringOnly || showArchived || showTrash)
  const [searchEpoch, setSearchEpoch] = useState(0)
  const clearAllFilters = () => {
    setSearchEpoch(e => e + 1); setQuery(''); setStage([]); setOwner([]); setClient([]); setSelectedBranch([])
    setExpiringOnly(false); setShowArchived(false); setShowTrash(false); setPage(1)
  }

  // Seed filters from a navigation intent (dashboard chart/KPI click). The stage key
  // maps to its label via the lookup; { kpi: 'expiring' } switches the aflopend-filter on.
  useEffect(() => {
    if (!intent) return
    const i = intent as { stage?: string; kpi?: string }
    if (i.stage != null) {
      const s = stages.find(x => String(x.value) === String(i.stage))
      setStage([s ? s.label : String(i.stage)])
    }
    if (i.kpi === 'expiring') setExpiringOnly(true)
    // setStage is usePageMemory's own useState setter (stable identity, never
    // actually changes) — listed to satisfy exhaustive-deps, not because this
    // effect should re-run on it.
  }, [intent, stages, setStage])

  // Reset to the first page + drop the selection whenever a filter changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); clearSelection() }, [stage, owner, client, selectedBranch, query, showArchived, showTrash])

  // Right-panel filters (stage · owner · client) — options derived from the loaded rows.
  const optionsFrom = (key: 'stage' | 'owner' | 'client') => {
    const m = new Map<string, number>()
    rows.forEach(r => { const v = r[key]; if (v) m.set(v, (m.get(v) ?? 0) + 1) })
    return [...m.entries()].map(([value, count]) => ({ value, label: value, count }))
  }
  const filterGroups = useMemo(() => buildOpportunityFilterGroups({
    t, tog, stage, setStage, owner, setOwner, client, setClient,
    selectedBranch, setSelectedBranch, showArchived, setShowArchived,
    optionsFrom, branchOptions,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [t, rows, stage, owner, client, selectedBranch, branchOptions, showArchived])

  // Publish/retract the filters for the topbar filter button + right panel.
  useEffect(() => {
    registerFilters('opportunities-page', filterGroups)
    return () => unregisterFilters('opportunities-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // Visible rows = the stage/owner/client selection applied client-side.
  // Three lifecycle views (TRASH-OVERAL-2, mirrors candidates): trash = pending_erase,
  // archived = archived only (so pending rows never double-show), default = active.
  const filteredAll = useMemo(() => {
    return rows.filter(r => {
      if (showTrash) { if (r.lifecycle !== 'pending_erase') return false }
      else if (showArchived) { if (r.lifecycle !== 'archived') return false }
      else if (r.archived) return false
      if (stage.length  && !stage.includes(r.stage))   return false
      if (owner.length  && !owner.includes(r.owner))   return false
      if (client.length && !client.includes(r.client)) return false
      // A reference-number query already narrowed `rows` server-side (exact `?ref=`) —
      // skip the free-text re-filter so the single matched deal isn't filtered back out.
      if (!refQuery && query.trim() && !`${r.title ?? ''} ${r.client ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())) return false
      // Aflopend: close date within today..+14 days (same window as the KPI count).
      if (expiringOnly) {
        const d = r.expectedCloseAt ? new Date(r.expectedCloseAt).getTime() : null
        if (d == null || d < dayStart || d >= dayStart + 15 * 86400000) return false
      }
      return true
    })
  }, [rows, stage, owner, client, query, refQuery, expiringOnly, dayStart, showArchived, showTrash])

  const totalRows = filteredAll.length
  const lastPage  = Math.max(1, Math.ceil(totalRows / pageSize))
  const filtered  = useMemo(() => filteredAll.slice((page - 1) * pageSize, page * pageSize), [filteredAll, page, pageSize])
  // Board rows never include archived deals: dragging one to a new stage would
  // PATCH /opportunities/{id}, which 404s once soft-deleted (OpportunityController::
  // update has no withTrashed()) — the archived-mixed view is table-only.
  const boardRows = useMemo(() => filteredAll.filter(r => !r.archived), [filteredAll])

  return (
    <>
      {addOpen && <AddOpportunityModal onClose={() => setAddOpen(false)} onCreated={o => { setAddOpen(false); handleCreated(o) }} users={users} customers={customers} />}
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* KPI block: donuts (stage/owner, click-to-filter) + value KPI cards */}
          <OpportunitiesInsightsRow
            rows={rows} stages={stages} valueInHours={valueInHours}
            stage={stage} owner={owner} client={client}
            onPickStage={pickOne(setStage)} onClearStage={() => setStage([])}
            onPickOwner={pickOne(setOwner)} onClearOwner={() => setOwner([])}
            onPickClient={pickOne(setClient)} onClearClient={() => setClient([])}
            onSetStageFilter={setStage}
            /* VESTIGING-2: an explicit branch filter EXCLUDES deals with no branch linked
               yet — an empty list must say so, not read as "nothing here". The shared
               InsightsRow already owns this banner; the wrapper just forwards it. */
            notice={selectedBranch.length > 0 && totalRows === 0 ? t('common:filters.branchExcludesUnassigned') : undefined}
          />

          {/* Toolbar — add on the LEFT, archived toggle + view toggle on the RIGHT. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10,
            padding: '0 24px 12px', minHeight: 36, flexShrink: 0 }}>
            {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
            <Button variant="primary" size="md" onClick={() => setAddOpen(true)}>
              + {t('page.add')}
            </Button>
            <HeaderSearch key={searchEpoch} onSearch={setQuery} placeholder={t('page.searchPlaceholder')} width={280} />
            <ClearFiltersButton active={anyFilterActive} onClear={clearAllFilters} />
            {/* Selection strip — count + clear (bulk actions land with C-41). */}
            {selectedIds.size > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text)' }}>
                <span>{t('page.selected', { count: selectedIds.size })}</span>
                {/* HUISSTIJL-1: the shared Button atom (ghostAccent = plain coloured
                    text link, no fill/border) — never a hand-styled <button>. */}
                <Button variant="ghostAccent" size="sm" onClick={clearSelection}>
                  {t('page.clearSelection')}
                </Button>
              </div>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Archived ⇄ trash are mutually exclusive views (mirrors candidates). */}
              <QuickViewToggle active={showArchived} onToggle={() => { setShowArchived(v => !v); setShowTrash(false) }}
                label={t('view.archived')} color="var(--color-archive)" icon={Archive} />
              <QuickViewToggle active={showTrash} onToggle={() => { setShowTrash(v => !v); setShowArchived(false) }}
                label={t('common:trash.view')} color="var(--color-trash)" icon={Trash2} />
              {/* Table/board switcher — shared soft-tint component (§4), never a solid
                  fill (last hand-rolled instance across the entity pages, audit sweep). */}
              <ViewModeToggle value={view} onChange={setView} options={[
                { id: 'table', icon: LayoutList, label: t('view.table') },
                { id: 'board', icon: Kanban, label: t('view.board') },
              ]} />
            </div>
          </div>

          {/* Table ⇄ board — ViewSwitch keeps both mounted (display toggle, not
              unmount) so the table's virtualizer never remeasures 0 on returning
              from the board (§ViewSwitch, mirrors candidates/customers/matches);
              row virtualization is now safe to enable. */}
          <ViewSwitch active={view} views={[
            {
              id: 'table',
              render: () => (
                <>
                  <div ref={tableScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
                    <OpportunitiesTable rows={filtered} loading={loading} error={error} valueInHours={valueInHours} stages={stages}
                      selectedId={selected?.id} onRowClick={selectOpportunity} stickyHeader scrollParentRef={tableScrollRef}
                      selectable selectedIds={selectedIds} onToggleRow={toggleRow} onToggleAll={toggleAll} />
                  </div>
                  <PaginationBar page={page} totalPages={lastPage} totalRows={totalRows}
                    pageSize={pageSize} onPageChange={setPage} pageSizeOptions={pageSizeOptions}
                    onPageSizeChange={n => { setPageSize(n); setPage(1) }} />
                </>
              ),
            },
            {
              id: 'board',
              render: () => (
                <OpportunitiesBoard rows={boardRows} stages={stages} valueInHours={valueInHours}
                  onMove={handleMove} selectedId={selected?.id} onSelect={selectOpportunity} />
              ),
            },
          ]} />
        </div>

        {/* Drill-down drawer — remounts (key) per opportunity so the tab re-inits */}
        <OpportunityDrawer
          key={selected?.id ?? 'none'}
          opportunity={selected}
          // KANSEN-A-3: the full tenant set (already fetch-all looped) — the
          // Statistieken tab's "other opportunities at this customer" source.
          allRows={rows}
          valueInHours={valueInHours}
          onClose={closeDrawer}
          expanded={drawerExpanded}
          onToggleExpand={() => setDrawerExpanded(v => !v)}
          onUpdate={updateOpportunity}
          stages={stages} users={users} customers={customers}
          // ARCHIVE-1: per-id delete/restore (§7 — UI-only gate; the backend
          // re-checks opportunities.delete / opportunities.update respectively —
          // the two routes require DIFFERENT permissions, so gate them separately).
          onArchive={hasPermission('opportunities.delete') ? archiveOpportunity : undefined}
          onRestore={hasPermission('opportunities.update') ? restoreOpportunity : undefined}
          // TRASH-OVERAL-2: shared trash section (mark = opportunities.delete, unmark =
          // opportunities.update; backend re-checks, §7). The patches are pure LOCAL
          // merges — updateOpportunity maps none of these keys, so no stray PATCH.
          trash={{
            canMark: hasPermission('opportunities.delete'),
            canUnmark: hasPermission('opportunities.update'),
            users: users.map(u => ({ value: String(u.id), label: u.name })),
            onMarked: id => updateOpportunity(id, { archived: true, lifecycle: 'pending_erase', pendingEraseAt: new Date().toISOString() }),
            onUnmarked: id => updateOpportunity(id, { lifecycle: 'archived', pendingEraseAt: null }),
          }}
        />
        {archiveConfirmDialog}
      </div>
    </>
  )
}
