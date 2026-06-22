import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '../../lib/api'
import { useUsers } from '../../lib/queries'
import { useOpportunityStages } from '../../lib/useOpportunityStages'
import { mapOpportunity } from './data/mapOpportunity'
import OpportunitiesInsightsRow from './OpportunitiesInsightsRow'
import OpportunitiesTable from './OpportunitiesTable'
import OpportunityDrawer from './OpportunityDrawer'
import AddOpportunityModal from './AddOpportunityModal'

// Single-select donut pick: clicking the active segment clears it (mirrors ApplicationsPage).
const pickOne = (set) => (d) => {
  const v = d?.key ?? d?.payload?.key ?? d?.name
  if (v != null) set(p => (p.length === 1 && p[0] === v) ? [] : [v])
}

// OpportunitiesPage — thin container: loads opportunities, feeds the config-driven
// KPI row, filters the table by the donut selection, and wires the create modal +
// drill-down drawer (header pickers patch stage/owner/customer optimistically).
export default function OpportunitiesPage() {
  const { t } = useTranslation('opportunities')
  const { data: users = [] } = useUsers()
  const { stages, stageMeta } = useOpportunityStages()

  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)
  const [stage,   setStage]   = useState([]) // selected stage keys (0 or 1)
  const [owner,   setOwner]   = useState([]) // selected owner keys (0 or 1)
  const [customers,      setCustomers]      = useState([])
  const [selected,       setSelected]       = useState(null)
  const [drawerExpanded, setDrawerExpanded] = useState(false)
  const [addOpen,        setAddOpen]        = useState(false)

  // Load opportunities; a missing endpoint (404) is an empty list, not an error.
  useEffect(() => {
    let alive = true
    api.get('/opportunities')
      .then(r => { if (alive) setRows((r.data?.data ?? r.data ?? []).map(mapOpportunity)) })
      .catch(e => { if (alive && e?.response?.status && e.response.status !== 404) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // Load customers once for the drawer/modal pickers.
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/customers', { signal: ctrl.signal })
      .then(res => setCustomers(unwrapList(res).rows.map(c => ({ id: c.id, name: c.name ?? c.company_name ?? '—' }))))
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  // Visible rows = the stage/owner donut selection applied client-side.
  const filtered = useMemo(() => rows.filter(r => {
    if (stage.length && !stage.includes(r.stage)) return false
    if (owner.length && !owner.includes(r.owner)) return false
    return true
  }), [rows, stage, owner])

  // Drawer: select an opportunity, then refresh from the detail endpoint (ref-guarded).
  const selectedIdRef = useRef(null)
  const selectOpportunity = (o) => {
    if (selected?.id === o.id) { closeDrawer(); return }
    selectedIdRef.current = o.id
    setSelected(o); setDrawerExpanded(false)
    api.get(`/opportunities/${o.id}`)
      .then(r => { if (selectedIdRef.current === o.id) setSelected(mapOpportunity(r.data?.data ?? r.data)) })
      .catch(() => {})
  }
  const closeDrawer = () => { selectedIdRef.current = null; setSelected(null); setDrawerExpanded(false) }

  // A freshly created opportunity: prepend + open its drawer.
  const handleCreated = (o) => { setRows(prev => [o, ...prev]); setAddOpen(false); selectOpportunity(o) }

  // Header/picker edits flow back here: optimistic locally, then PATCH (UI keys → API keys).
  const updateOpportunity = (id, patch) => {
    const local = { ...patch }
    if ('stageValue' in patch) { const m = stageMeta(patch.stageValue); local.stage = m.label; local.stageColor = m.color }
    if ('ownerId'    in patch) { const u = users.find(x => x.id === patch.ownerId);     local.owner = u?.name ?? '' }
    if ('clientId'   in patch) { const c = customers.find(x => x.id === patch.clientId); local.client = c?.name ?? '' }

    setRows(prev => prev.map(x => x.id === id ? { ...x, ...local } : x))
    setSelected(prev => (prev && prev.id === id ? { ...prev, ...local } : prev))

    const body = {}
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

          {/* Toolbar — add button */}
          <div style={{ padding: '0 20px 12px', display: 'flex', minHeight: 36, flexShrink: 0 }}>
            <button onClick={() => setAddOpen(true)}
              style={{ marginLeft: 'auto', padding: '7px 14px', fontSize: 12, fontWeight: 500,
                background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              + {t('page.add')}
            </button>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
            <OpportunitiesTable rows={filtered} loading={loading} error={error}
              selectedId={selected?.id} onRowClick={selectOpportunity} />
          </div>
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
