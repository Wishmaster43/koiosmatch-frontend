import { useState, useEffect, useMemo, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, List, LayoutGrid, Archive } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useRightPanel } from '@/context/RightPanelContext'
import api from '@/lib/api'
import { notify } from '@/lib/notify'
import InsightsRow from '@/components/insights/InsightsRow'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import MatchesTable from './MatchesTable'
import MatchesBoard from './MatchesBoard'
import type { BoardColumn } from './MatchesBoard'
import MatchDrawer from './MatchDrawer'
import MatchesBulkBar from './MatchesBulkBar'
import AddMatchModal from './AddMatchModal'
import PaginationBar from '@/components/ui/PaginationBar'
import { useMatches } from './hooks/useMatches'
import { useMatchesBulkActions } from './hooks/useMatchesBulkActions'
import type { MatchRow } from '@/types/match'
import type { Id } from '@/types/common'

// MatchesPage — loads matches, shows an insights strip and paginates the table.
export default function MatchesPage() {
  const { t } = useTranslation('matches')
  // Scroll container for row virtualization (F-11): DataTable virtualizes against it.
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const auth = useAuth()
  const user = auth?.user
  // Coupling is authorization-gated in the UI; the backend re-checks (§7).
  const hasPermission = auth?.hasPermission ?? (() => false)
  // Right-panel filter state: archived is off by default (§3B — archived matches
  // stay searchable but out of the default view so KPI totals drop).
  const [showArchived, setShowArchived] = useState(false)
  // Data (fetch + mapping) lives in the hook (§3); the page only derives + renders.
  const { rows, loading, error, addMatch, updateMatch } = useMatches(showArchived)
  const { registerFilters, unregisterFilters } = useRightPanel()
  const [page,        setPage]        = useState(1)
  const [pageSize,    setPageSize]    = useState(() => user?.default_per_page ?? 50)
  const [stageFilter, setStageFilter] = useState<string[]>([])
  const [ownerFilter, setOwnerFilter] = useState<string[]>([])
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

  // Aggregate stage data for the donut.
  const stageData = useMemo(() => {
    const m: Record<string, { name: string; key: string; color: string; value: number }> = {}
    rows.forEach(r => { if (r.stage) (m[r.stage] ??= { name: r.stage, key: r.stage, color: r.stageColor, value: 0 }).value++ })
    return Object.values(m)
  }, [rows])

  const ownerData = useMemo(() => {
    const m: Record<string, { name: string; key: string; color: string; value: number }> = {}
    rows.forEach(r => { if (r.owner) (m[r.owner] ??= { name: r.owner, key: r.owner, color: '#6B7280', value: 0 }).value++ })
    return Object.values(m)
  }, [rows])

  // Multi-select toggle for the right-panel filter groups (add/remove a value).
  const tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string | number) =>
    set(p => p.includes(String(v)) ? p.filter(x => x !== String(v)) : [...p, String(v)])

  // Right-panel filters: status (stage) + owner. The same stageFilter/ownerFilter
  // drive the donuts, so both stay in sync. (Archived lives in the toolbar segment.)
  const filterGroups = useMemo(() => [
    { key: 'stage', label: t('filters.stage'), selected: stageFilter,
      options: stageData.map(d => ({ value: d.key, label: d.name, count: d.value })),
      onToggle: tog(setStageFilter) },
    { key: 'owner', label: t('filters.owner'), selected: ownerFilter,
      options: ownerData.map(d => ({ value: d.key, label: d.name, count: d.value })),
      onToggle: tog(setOwnerFilter) },
  ], [t, stageFilter, ownerFilter, stageData, ownerData])

  // Register/unregister the filters in the right panel.
  useEffect(() => {
    registerFilters('matches-page', filterGroups)
    return () => unregisterFilters('matches-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // Reset to the first page and clear the selection whenever a filter changes
  // (kept out of the memo — setting state during render can loop).
  useEffect(() => { setPage(1); setSelectedIds(new Set()) }, [stageFilter, ownerFilter, showArchived])

  // Filter the visible rows by donut selection.
  const filteredAll = useMemo(() => {
    return rows.filter(r => {
      if (stageFilter.length && !stageFilter.includes(r.stage)) return false
      if (ownerFilter.length && !ownerFilter.includes(r.owner)) return false
      return true
    })
  }, [rows, stageFilter, ownerFilter])

  const totalRows = filteredAll.length
  const lastPage  = Math.max(1, Math.ceil(totalRows / pageSize))
  const paged     = useMemo(() => filteredAll.slice((page - 1) * pageSize, page * pageSize), [filteredAll, page, pageSize])

  // KPI: count active (non-rejected/non-done) and hired matches.
  const activeCount = rows.filter(r => !['rejected', 'closed'].includes(r.stage?.toLowerCase())).length
  const hiredCount  = rows.filter(r => ['hired', 'aangenomen'].includes(r.stage?.toLowerCase())).length
  const avgScore    = rows.length ? Math.round(rows.reduce((s, r) => s + (r.score ?? 0), 0) / rows.length) : null

  // Donuts drive the stage/owner filters; each clears its own selection.
  const insightDonuts: DonutSpec[] = [
    { key: 'stage', title: t('insights.stage'), data: stageData, onPick: pickOne(setStageFilter),
      active: stageFilter.length > 0, onClear: () => setStageFilter([]) },
    { key: 'owner', title: t('insights.owner'), data: ownerData, onPick: pickOne(setOwnerFilter),
      active: ownerFilter.length > 0, onClear: () => setOwnerFilter([]) },
  ]

  const insightKpis: KpiSpec[] = [
    { key: 'total',    label: t('kpi.total'),    value: rows.length, color: 'var(--color-primary)' },
    { key: 'active',   label: t('kpi.active'),   value: activeCount, color: 'var(--color-primary)' },
    { key: 'hired',    label: t('kpi.hired'),    value: hiredCount,  color: 'var(--color-success)' },
    { key: 'avgScore', label: t('kpi.avgScore'), value: avgScore != null ? `${avgScore}%` : '—', color: 'var(--color-primary)' },
  ]

  // Direct-match creation modal (§3B "direct match" path).
  const [addOpen, setAddOpen] = useState(false)
  // Read-only drill-down: the clicked row opens the MatchDrawer beside the table.
  const [selected, setSelected] = useState<MatchRow | null>(null)
  const [drawerExpanded, setDrawerExpanded] = useState(false)

  // View toggle: table ⇄ board (planboard). Board columns = the stages present.
  const [view, setView] = useState<'table' | 'board'>('table')
  const stageColumns: BoardColumn[] = useMemo(
    () => stageData.map(d => ({ key: d.key, label: d.name, color: d.color })), [stageData])

  // Drag a card to another column → change the match's stage (optimistic + persist).
  const handleMove = (id: Id, stageKey: string) => {
    const col = stageColumns.find(c => c.key === stageKey)
    updateMatch(id, { stage: stageKey, stageColor: col?.color ?? '#6E8FD6' })
    api.patch(`/matches/${id}`, { stage: stageKey }).catch(() => notify('error', t('bulk.mutateError')))
  }

  // Toolbar segmented control merges view + archived into one 3-way selector:
  // Matches (active table) · Board (kanban) · Gearchiveerd (archived table).
  const mode = view === 'board' ? 'board' : showArchived ? 'archived' : 'matches'
  const setMode = (m: 'matches' | 'board' | 'archived') => {
    if (m === 'board')         { setView('board'); setShowArchived(false) }
    else if (m === 'archived') { setView('table'); setShowArchived(true) }
    else                       { setView('table'); setShowArchived(false) }
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 24px 10px', flexShrink: 0, minHeight: 46 }}>
        <div style={{ flex: 1, display: 'flex' }}>
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
            <button
              onClick={() => setAddOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 13,
                fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'var(--color-primary)', color: '#fff' }}>
              <Plus size={15} aria-hidden="true" /> {t('add.button')}
            </button>
          )}
        </div>

        {/* Matches | Board | Gearchiveerd — one 3-way segmented control (right) */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 2 }}>
          {([['matches', List], ['board', LayoutGrid], ['archived', Archive]] as const).map(([m, Icon]) => (
            <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', fontSize: 12.5, fontWeight: 500,
                borderRadius: 6, border: 'none', cursor: 'pointer',
                background: mode === m ? 'var(--color-primary)' : 'transparent', color: mode === m ? '#fff' : 'var(--text)' }}>
              <Icon size={14} aria-hidden="true" /> {t(`view.${m}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Board (planboard) or table + pagination */}
      {view === 'board' ? (
        <MatchesBoard rows={filteredAll} columns={stageColumns} onMove={handleMove}
          onSelect={setSelected} selectedId={selected?.id} />
      ) : (
        <>
          <div ref={tableScrollRef} style={{ flex: 1, overflow: 'auto', padding: '0 24px 16px' }}>
            <MatchesTable rows={paged} loading={loading} error={error} stickyHeader
              scrollParentRef={tableScrollRef} onRowClick={setSelected} selectedId={selected?.id}
              selectable selectedIds={selectedIds} onToggleRow={toggleRow} onToggleAll={toggleAll} />
          </div>

          <PaginationBar page={page} totalPages={lastPage} totalRows={totalRows}
            pageSize={pageSize} onPageChange={setPage}
            onPageSizeChange={n => { setPageSize(n); setPage(1) }} />
        </>
      )}
      </div>

      {/* Read-only drill-down drawer */}
      <MatchDrawer match={selected} onClose={() => setSelected(null)}
        expanded={drawerExpanded} onToggleExpand={() => setDrawerExpanded(v => !v)} />

      {/* Direct-match creation modal */}
      {addOpen && <AddMatchModal onClose={() => setAddOpen(false)} onCreated={addMatch} />}
    </div>
  )
}
