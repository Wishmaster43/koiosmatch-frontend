import { useState, useEffect, useMemo, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutList, Kanban } from 'lucide-react'
import api, { unwrapList } from '../../lib/api'
import { useUsers } from '../../lib/queries'
import { useAuth } from '../../context/AuthContext'
import { useOpportunityStages } from '../../lib/useOpportunityStages'
import { mapOpportunity } from './data/mapOpportunity'
import OpportunitiesInsightsRow from './OpportunitiesInsightsRow'
import OpportunitiesTable from './OpportunitiesTable'
import OpportunitiesBoard from './OpportunitiesBoard'
import OpportunityDrawer from './OpportunityDrawer'
import AddOpportunityModal from './AddOpportunityModal'
import PaginationBar from '../../components/ui/PaginationBar'
import type { Opportunity, ApiOpportunity } from '../../types/opportunity'
import type { Id } from '../../types/common'

interface AppUser { id: Id; name: string }
interface PageCustomer { id: Id; name: string }

// Single-select donut pick: clicking the active segment clears it.
const pickOne = (set: Dispatch<SetStateAction<string[]>>) => (d: unknown) => {
  const o = d as { key?: string; name?: string; payload?: { key?: string } } | null | undefined
  const v = o?.key ?? o?.payload?.key ?? o?.name
  if (v != null) set(p => (p.length === 1 && p[0] === v) ? [] : [v])
}

// OpportunitiesPage — thin container: loads opportunities, feeds the config-driven
// KPI row, filters the table by the donut selection, and wires the create modal +
// drill-down drawer (header pickers patch stage/owner/customer optimistically).
export default function OpportunitiesPage() {
  const { t } = useTranslation('opportunities')
  const { data: users = [] } = useUsers() as { data?: AppUser[] }
  const { stages, stageMeta } = useOpportunityStages()

  const auth = useAuth()
  const user = auth?.user as { default_per_page?: number } | null | undefined
  const [rows,     setRows]     = useState<Opportunity[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)
  const [view,     setView]     = useState('table')  // 'table' | 'board'
  const [page,     setPage]     = useState(1)
  const [pageSize, setPageSize] = useState(() => user?.default_per_page ?? 50)
  const [stage,    setStage]    = useState<string[]>([]) // selected stage keys (0 or 1)
  const [owner,    setOwner]    = useState<string[]>([]) // selected owner keys (0 or 1)
  const [customers,      setCustomers]      = useState<PageCustomer[]>([])
  const [selected,       setSelected]       = useState<Opportunity | null>(null)
  const [drawerExpanded, setDrawerExpanded] = useState(false)
  const [addOpen,        setAddOpen]        = useState(false)

  // Load opportunities; a missing endpoint (404) is an empty list, not an error.
  useEffect(() => {
    let alive = true
    api.get('/opportunities')
      .then(r => { if (alive) setRows(((r.data?.data ?? r.data ?? []) as ApiOpportunity[]).map(mapOpportunity)) })
      .catch(e => { if (alive && e?.response?.status && e.response.status !== 404) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // Load customers once for the drawer/modal pickers.
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/customers', { signal: ctrl.signal })
      .then(res => setCustomers(unwrapList<{ id?: Id; name?: string; company_name?: string }>(res).rows.map(c => ({ id: c.id ?? '', name: c.name ?? c.company_name ?? '—' }))))
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

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

  // Drawer: select an opportunity, then refresh from the detail endpoint (ref-guarded).
  const selectedIdRef = useRef<Id | null>(null)
  const closeDrawer = () => { selectedIdRef.current = null; setSelected(null); setDrawerExpanded(false) }
  const selectOpportunity = (o: Opportunity) => {
    if (selected?.id === o.id) { closeDrawer(); return }
    selectedIdRef.current = o.id ?? null
    setSelected(o); setDrawerExpanded(false)
    api.get(`/opportunities/${o.id}`)
      .then(r => { if (selectedIdRef.current === o.id) setSelected(mapOpportunity(r.data?.data ?? r.data)) })
      .catch(() => {})
  }

  // A freshly created opportunity: prepend + open its drawer.
  const handleCreated = (o: Opportunity) => { setRows(prev => [o, ...prev]); setAddOpen(false); selectOpportunity(o) }

  // Board drag-and-drop: move to a new stage optimistically, then PATCH.
  const handleMove = (id: Id, stageValue: string | number) => {
    const m = stageMeta(String(stageValue))
    setRows(prev => prev.map(r => r.id === id ? ({ ...r, stage: m.label, stageValue, stageColor: m.color } as Opportunity) : r))
    const s = stages.find(x => x.value === stageValue)
    if (s?.id) api.patch(`/opportunities/${id}`, { opportunity_stage_id: s.id }).catch(() => {})
  }

  // Header/picker edits flow back here: optimistic locally, then PATCH (UI keys → API keys).
  const updateOpportunity = (id: Id | undefined, patch: Record<string, unknown>) => {
    const local: Record<string, unknown> = { ...patch }
    if ('stageValue' in patch) { const m = stageMeta(patch.stageValue as string); local.stage = m.label; local.stageColor = m.color }
    if ('ownerId'    in patch) { const u = users.find(x => x.id === patch.ownerId);     local.owner = u?.name ?? '' }
    if ('clientId'   in patch) { const c = customers.find(x => x.id === patch.clientId); local.client = c?.name ?? '' }

    setRows(prev => prev.map(x => x.id === id ? ({ ...x, ...local } as Opportunity) : x))
    setSelected(prev => (prev && prev.id === id ? ({ ...prev, ...local } as Opportunity) : prev))

    const body: Record<string, unknown> = {}
    if ('stageValue' in patch) { const s = stages.find(x => x.value === patch.stageValue); body.opportunity_stage_id = s?.id ?? null }
    if ('ownerId'    in patch) body.owner_id    = patch.ownerId || null
    if ('clientId'   in patch) body.customer_id = patch.clientId || null
    if (Object.keys(body).length) api.patch(`/opportunities/${id}`, body).catch(() => {})
  }

  return (
    <>
      {addOpen && <AddOpportunityModal onClose={() => setAddOpen(false)} onCreated={handleCreated} users={users} customers={customers} />}
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
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
                <OpportunitiesTable rows={filtered} loading={loading} error={error}
                  selectedId={selected?.id} onRowClick={selectOpportunity} stickyHeader />
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
