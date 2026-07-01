import { useState, useEffect, useMemo, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutList, Kanban, Archive } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useRightPanel } from '@/context/RightPanelContext'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
import OpportunitiesInsightsRow from './OpportunitiesInsightsRow'
import OpportunitiesTable from './OpportunitiesTable'
import OpportunitiesBoard from './OpportunitiesBoard'
import OpportunityDrawer from './OpportunityDrawer'
import AddOpportunityModal from './AddOpportunityModal'
import PaginationBar from '@/components/ui/PaginationBar'
import { useOpportunitiesData } from './hooks/useOpportunitiesData'

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
export default function OpportunitiesPage() {
  const { t } = useTranslation('opportunities')
  // Scroll container for row virtualization (F-11): DataTable virtualizes against it.
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const auth = useAuth()
  const user = auth?.user as { default_per_page?: number } | null | undefined
  const { registerFilters, unregisterFilters } = useRightPanel()
  // Tenant setting: show the deal magnitude in hours instead of euro (Settings → Kansen).
  const valueInHours = getBoolSetting(useAllSettings(), 'opportunity_value_in_hours', false)

  // Data layer (§3): list + customers + selection + optimistic mutations.
  const {
    rows, loading, error, customers, users, stages,
    showArchived, setShowArchived,
    selected, drawerExpanded, setDrawerExpanded,
    selectedIds, toggleRow, toggleAll, clearSelection,
    selectOpportunity, closeDrawer, handleCreated, handleMove, updateOpportunity,
  } = useOpportunitiesData()

  const [view,     setView]     = useState('table')  // 'table' | 'board'
  const [page,     setPage]     = useState(1)
  const [pageSize, setPageSize] = useState(() => user?.default_per_page ?? 50)
  const [stage,    setStage]    = useState<string[]>([]) // selected stage labels (donut + panel)
  const [owner,    setOwner]    = useState<string[]>([]) // selected owner names (donut + panel)
  const [client,   setClient]   = useState<string[]>([]) // selected client names (panel)
  const [addOpen,  setAddOpen]  = useState(false)

  // Reset to the first page + drop the selection whenever a filter changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); clearSelection() }, [stage, owner, client])

  // Right-panel filters (stage · owner · client) — options derived from the loaded rows.
  const optionsFrom = (key: 'stage' | 'owner' | 'client') => {
    const m = new Map<string, number>()
    rows.forEach(r => { const v = r[key]; if (v) m.set(v, (m.get(v) ?? 0) + 1) })
    return [...m.entries()].map(([value, count]) => ({ value, label: value, count }))
  }
  const filterGroups = useMemo(() => [
    { key: 'stage',  type: 'search-select', label: t('insights.stage'), selected: stage,  options: optionsFrom('stage'),  onToggle: tog(setStage) },
    { key: 'owner',  type: 'search-select', label: t('insights.owner'), selected: owner,  options: optionsFrom('owner'),  onToggle: tog(setOwner) },
    { key: 'client', type: 'search-select', label: t('cols.client'),    selected: client, options: optionsFrom('client'), onToggle: tog(setClient) },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, rows, stage, owner, client])

  // Publish/retract the filters for the topbar filter button + right panel.
  useEffect(() => {
    registerFilters('opportunities-page', filterGroups)
    return () => unregisterFilters('opportunities-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // Visible rows = the stage/owner/client selection applied client-side.
  const filteredAll = useMemo(() => {
    return rows.filter(r => {
      // Archived view shows only archived rows; otherwise archived (soft-deleted) are hidden.
      if (showArchived ? !r.archived : r.archived) return false
      if (stage.length  && !stage.includes(r.stage))   return false
      if (owner.length  && !owner.includes(r.owner))   return false
      if (client.length && !client.includes(r.client)) return false
      return true
    })
  }, [rows, stage, owner, client, showArchived])

  const totalRows = filteredAll.length
  const lastPage  = Math.max(1, Math.ceil(totalRows / pageSize))
  const filtered  = useMemo(() => filteredAll.slice((page - 1) * pageSize, page * pageSize), [filteredAll, page, pageSize])

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
          />

          {/* Toolbar — add on the LEFT, archived + view toggle on the RIGHT (mirror candidates). */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 24px', background: 'var(--bg)', flexShrink: 0 }}>
            <button onClick={() => setAddOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600,
                borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--color-primary)', color: '#fff' }}>
              + {t('page.add')}
            </button>
            {/* Selection strip — count + clear (bulk actions land with C-41). */}
            {selectedIds.size > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text)' }}>
                <span>{t('page.selected', { count: selectedIds.size })}</span>
                <button onClick={clearSelection}
                  style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  {t('page.clearSelection')}
                </button>
              </div>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Archived (soft-deleted) view toggle → ?include_archived=1. */}
              <button onClick={() => setShowArchived(v => !v)} title={t('page.archivedView')}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, fontWeight: showArchived ? 600 : 500,
                  borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${showArchived ? 'var(--color-primary)' : 'var(--border)'}`,
                  background: showArchived ? 'var(--color-primary-bg)' : 'var(--surface)',
                  color: showArchived ? 'var(--color-primary)' : 'var(--text)' }}>
                <Archive size={14} /> {t('page.archived')}
              </button>
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

          {/* Content */}
          {view === 'table' ? (
            <>
              <div ref={tableScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
                {/* No row virtualization: a paginated (50/page) list is small, and virtualizing
                    against a scroll container that unmounts on the board↔list toggle left the
                    table blank on return (virtualizer measured 0). Sticky header still works. */}
                <OpportunitiesTable rows={filtered} loading={loading} error={error} valueInHours={valueInHours}
                  selectedId={selected?.id} onRowClick={selectOpportunity} stickyHeader
                  selectable selectedIds={selectedIds} onToggleRow={toggleRow} onToggleAll={toggleAll} />
              </div>
              <PaginationBar page={page} totalPages={lastPage} totalRows={totalRows}
                pageSize={pageSize} onPageChange={setPage}
                onPageSizeChange={n => { setPageSize(n); setPage(1) }} />
            </>
          ) : (
            <OpportunitiesBoard rows={filteredAll} stages={stages}
              onMove={handleMove} selectedId={selected?.id} onSelect={selectOpportunity} />
          )}
        </div>

        {/* Drill-down drawer — remounts (key) per opportunity so the tab re-inits */}
        <OpportunityDrawer
          key={selected?.id ?? 'none'}
          opportunity={selected}
          onClose={closeDrawer}
          expanded={drawerExpanded}
          onToggleExpand={() => setDrawerExpanded(v => !v)}
          onUpdate={updateOpportunity}
          stages={stages} users={users} customers={customers}
        />
      </div>
    </>
  )
}
