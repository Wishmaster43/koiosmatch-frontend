import { useState, useEffect, useMemo, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutList, Kanban } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
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

// OpportunitiesPage — thin container: the data layer (load + mutations) lives in
// useOpportunitiesData; the page only derives the filtered/paged view and renders.
export default function OpportunitiesPage() {
  const { t } = useTranslation('opportunities')
  // Scroll container for row virtualization (F-11): DataTable virtualizes against it.
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const auth = useAuth()
  const user = auth?.user as { default_per_page?: number } | null | undefined

  // Data layer (§3): list + customers + selection + optimistic mutations.
  const {
    rows, loading, error, customers, users, stages,
    selected, drawerExpanded, setDrawerExpanded,
    selectOpportunity, closeDrawer, handleCreated, handleMove, updateOpportunity,
  } = useOpportunitiesData()

  const [view,     setView]     = useState('table')  // 'table' | 'board'
  const [page,     setPage]     = useState(1)
  const [pageSize, setPageSize] = useState(() => user?.default_per_page ?? 50)
  const [stage,    setStage]    = useState<string[]>([]) // selected stage keys (0 or 1)
  const [owner,    setOwner]    = useState<string[]>([]) // selected owner keys (0 or 1)
  const [addOpen,  setAddOpen]  = useState(false)

  // Reset to the first page whenever a filter changes.
  useEffect(() => { setPage(1) }, [stage, owner])

  // Visible rows = the stage/owner donut selection applied client-side.
  const filteredAll = useMemo(() => {
    return rows.filter(r => {
      if (stage.length && !stage.includes(r.stage)) return false
      if (owner.length && !owner.includes(r.owner)) return false
      return true
    })
  }, [rows, stage, owner])

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
            rows={rows}
            stage={stage} owner={owner}
            onPickStage={pickOne(setStage)} onClearStage={() => setStage([])}
            onPickOwner={pickOne(setOwner)} onClearOwner={() => setOwner([])}
          />

          {/* Toolbar — actions right-aligned (same layout as TasksPage) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end',
            padding: '8px 24px', background: 'var(--bg)', flexShrink: 0 }}>
            <button onClick={() => setAddOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600,
                borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--color-primary)', color: '#fff' }}>
              + {t('page.add')}
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

          {/* Content */}
          {view === 'table' ? (
            <>
              <div ref={tableScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
                <OpportunitiesTable rows={filtered} loading={loading} error={error}
                  selectedId={selected?.id} onRowClick={selectOpportunity} stickyHeader scrollParentRef={tableScrollRef} />
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
