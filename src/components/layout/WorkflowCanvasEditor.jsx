/**
 * WorkflowCanvasEditor — the visual drag-and-drop workflow builder.
 *
 * Renders the node graph (via @xyflow/react / ReactFlow): the canvas, nodes,
 * connecting edges, minimap and controls. Lets the user add modules from a
 * picker, wire them together, configure each module in a side panel, and
 * save/run the workflow.
 *
 * Main blocks below:
 *   - Schedule helpers      → turn a trigger config into a human-readable label
 *   - Field inputs          → render the right form control per schema field type
 *                             (incl. AgentSelectField which fetches /ai/agents)
 *   - ModulePicker          → lists modules, filtered by which apps are enabled
 *   - Node / edge components → how each block and connection looks on the canvas
 *   - Editor component       → owns state, save/run, and the config side panel
 */
import { useState, useCallback, useEffect } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  X, Save, Play, Loader2, Plus, Trash2,
  Zap, CheckCircle, AlertCircle, List, Clock,
  ChevronDown,
} from 'lucide-react'
import { MODULE_META, MODULE_SCHEMAS, MODULE_APP_MAP } from '@/modules/index'
import { useApps } from '@/context/AppsContext'
import { AgentsTab, PromptsTab, FAQTab, KnowledgeTab, ToolsTab } from '../ai/AIManagementTabs'
import { uid, mkEdge, NODE_W, NODE_H, stepsToFlow, flowToSteps } from './workflow/serialization'
import { FieldInput } from './workflow/fields'
import { ScheduleModal, scheduleLabel } from './workflow/ScheduleModal'
import { EdgeAddContext, EdgeDeleteContext, EdgeFilterContext, NodeRunContext } from './workflow/contexts'
import { EdgeFilterPanel, OutputPanel, NODE_TYPES, EDGE_TYPES } from './workflow/canvas'

// ── Module picker ─────────────────────────────────────────────────────────────

const CATEGORY_ORDER = ['Alle', 'Triggers', 'Kandidaten', 'Sollicitaties', 'Vacatures', 'Matches', 'Kansen', 'Taken', 'Klanten', 'Planning', 'Communicatie', 'AI', 'ShiftManager', 'HelloFlex', 'Intus', 'Flow beheer', 'Tekst & Parsing']

function ModulePicker({ insertAfterEdgeId, onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const [tab,    setTab]    = useState('Alle')
  const { isAppEnabled } = useApps()

  // Filter out modules whose app is not enabled
  const isModuleEnabled = (type) => {
    const req = MODULE_APP_MAP[type]
    if (!req) return true
    const apps = Array.isArray(req) ? req : [req]
    return apps.some(a => isAppEnabled(a))
  }

  const allEntries = Object.entries(MODULE_META).filter(([type]) => isModuleEnabled(type))

  const visible = allEntries.filter(([, m]) => {
    const matchSearch = !search || m.label.toLowerCase().includes(search.toLowerCase())
    const matchTab    = tab === 'Alle' || m.category === tab
    return matchSearch && matchTab
  })

  // Count per category
  const counts = {}
  allEntries.forEach(([, m]) => {
    const c = m.category ?? 'Overig'
    counts[c] = (counts[c] ?? 0) + 1
  })

  const renderRow = ([type, meta]) => {
    const Icon = meta.Icon
    return (
      <button key={type} type="button"
        onClick={() => { onSelect(type, insertAfterEdgeId); onClose() }}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={15} color={meta.color} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{meta.label}</div>
        </div>
      </button>
    )
  }

  // In "Alle" tab (or search), render with category dividers
  const renderGrouped = () => {
    const groups = {}
    visible.forEach(entry => {
      const cat = entry[1].category ?? 'Overig'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(entry)
    })
    const orderedCats = CATEGORY_ORDER.filter(c => c !== 'Alle' && groups[c])
    const remaining = Object.keys(groups).filter(c => !CATEGORY_ORDER.includes(c))
    return [...orderedCats, ...remaining].map((cat, i) => (
      <div key={cat}>
        {i > 0 && <div style={{ height: 1, background: '#F3F4F6', margin: '4px 0' }} />}
        <div style={{ padding: '6px 16px 2px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{cat}</div>
        {groups[cat].map(renderRow)}
      </div>
    ))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}>
      <div style={{ width: 880, maxWidth: '94vw', maxHeight: '82vh', background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>

        {/* Header + zoeken */}
        <div style={{ padding: '14px 16px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Module kiezen</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' }}>
              <X size={16} />
            </button>
          </div>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Zoeken..."
            style={{ width: '100%', padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, outline: 'none', background: '#F9FAFB', boxSizing: 'border-box', marginBottom: 12 }} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid #F3F4F6', flexShrink: 0, padding: '0 8px' }}>
          {CATEGORY_ORDER.filter(c => c === 'Alle' || counts[c]).map(cat => (
            <button key={cat} type="button" onClick={() => { setTab(cat); }}
              style={{
                padding: '7px 12px', fontSize: 12, fontWeight: tab === cat ? 700 : 400,
                color: tab === cat ? 'var(--color-primary)' : '#6B7280',
                background: 'none', border: 'none', borderBottom: tab === cat ? '2px solid var(--color-primary)' : '2px solid transparent',
                cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: -1,
              }}>
              {cat}
            </button>
          ))}
        </div>

        {/* Lijst */}
        <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 8 }}>
          {visible.length === 0 && (
            <p style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}>Geen modules gevonden</p>
          )}
          {visible.length > 0 && (tab === 'Alle' || search)
            ? renderGrouped()
            : visible.map(renderRow)
          }
        </div>
      </div>
    </div>
  )
}

// ── Config panel ──────────────────────────────────────────────────────────────

const MANAGE_TABS = ['agents', 'prompts', 'faq', 'knowledge', 'tools']

function ConfigPanel({ node, onUpdate, onDelete, onTabChange }) {
  const [activeTab, setActiveTab] = useState('instellingen')

  const switchTab = (id) => { setActiveTab(id); onTabChange?.(id) }

  // Reset tab when selected node changes
  useEffect(() => { setActiveTab('instellingen'); onTabChange?.('instellingen') }, [node?.id])

  if (!node) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={20} color="#D1D5DB" />
        </div>
        <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.5 }}>Klik op een module<br />om de configuratie te zien</p>
      </div>
    )
  }
  const meta   = MODULE_META[node.data.type]
  const schema = MODULE_SCHEMAS[node.data.type] || []
  const Icon   = meta?.Icon
  const output = node.data.output

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Module header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 0', flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: meta?.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {Icon && <Icon size={16} color={meta?.color} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta?.label}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>{meta?.category}</div>
        </div>
        <button onClick={() => onDelete(node.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: 4, display: 'flex' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
          onMouseLeave={e => (e.currentTarget.style.color = '#D1D5DB')}
          title="Module verwijderen">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #F3F4F6', flexShrink: 0, padding: '8px 16px 0', overflowX: 'auto' }}>
        {[
          { id: 'instellingen', label: 'Instellingen' },
          { id: 'uitvoering',   label: output ? `Uitvoering (${Array.isArray(output) ? output.length : 1})` : 'Uitvoering' },
          ...(node.data.type === 'ai_agent' ? [
            { id: 'agents',    label: 'Agents' },
            { id: 'prompts',   label: 'Prompts' },
            { id: 'faq',       label: "FAQ's" },
            { id: 'knowledge', label: 'Kennisbank' },
            { id: 'tools',     label: 'Tools' },
          ] : []),
        ].map(t => (
          <button key={t.id} type="button" onClick={() => switchTab(t.id)}
            style={{
              padding: '5px 10px', fontSize: 12, fontWeight: activeTab === t.id ? 600 : 400,
              color: activeTab === t.id ? 'var(--color-primary)' : '#6B7280',
              background: 'none', border: 'none',
              borderBottom: activeTab === t.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content — management tabs */}
      {activeTab === 'agents'    && <div style={{ flex: 1, overflow: 'hidden', padding: 12 }}><AgentsTab /></div>}
      {activeTab === 'prompts'   && <div style={{ flex: 1, overflow: 'hidden', padding: 12 }}><PromptsTab /></div>}
      {activeTab === 'faq'       && <div style={{ flex: 1, overflow: 'hidden', padding: 12 }}><FAQTab /></div>}
      {activeTab === 'knowledge' && <div style={{ flex: 1, overflow: 'hidden', padding: 12 }}><KnowledgeTab /></div>}
      {activeTab === 'tools'     && <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}><ToolsTab /></div>}

      {/* Tab content */}
      {activeTab === 'instellingen' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {schema
            .filter(field => {
              if (!field.showIf) return true
              const ctrl = schema.find(f => f.key === field.showIf.key)
              const cur  = node.data.config[field.showIf.key] ?? ctrl?.default
              const want = field.showIf.value
              return Array.isArray(want) ? want.includes(cur) : cur === want
            })
            .map(field => (
            <div key={field.key}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                {field.label}
              </label>
              <FieldInput field={field} value={node.data.config[field.key]}
                onChange={(key, val) => onUpdate(node.id, key, val)} />
              {field.hint && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{field.hint}</div>}
            </div>
          ))}
          {schema.length === 0 && (
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>Geen configuratie vereist.</p>
          )}
        </div>
      ) : !MANAGE_TABS.includes(activeTab) ? (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!output ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, padding: 24 }}>
              <Play size={24} color="#D1D5DB" />
              <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.5 }}>
                Nog geen uitvoerdata.<br />Druk op ▶ bij de module om te testen.
              </p>
            </div>
          ) : (
            <div style={{ padding: 12 }}>
              {Array.isArray(output) && (
                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 8, fontWeight: 500 }}>
                  {output.length} {output.length === 1 ? 'item' : 'items'}
                </div>
              )}
              <pre style={{
                fontSize: 11, lineHeight: 1.6, color: '#E2E8F0', background: '#1E293B',
                borderRadius: 8, padding: 12, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
              }}>
                {JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

// ── Logs panel ────────────────────────────────────────────────────────────────

const MOCK_LOGS = [
  {
    id: 1, ts: 'Vandaag 08:00', ok: true, duration: '3.2s',
    operations: 12, bundles: 87,
    steps: [
      { label: 'Webhook ontvangen',    ok: true,  duration: '0.1s', bundles: 1 },
      { label: 'Kandidaten Ophalen',   ok: true,  duration: '1.4s', bundles: 87 },
      { label: 'Filter',               ok: true,  duration: '0.2s', bundles: 64 },
      { label: 'WhatsApp versturen',   ok: true,  duration: '1.5s', bundles: 64 },
    ],
  },
  {
    id: 2, ts: 'Gisteren 08:00', ok: true, duration: '2.8s',
    operations: 9, bundles: 92,
    steps: [
      { label: 'Webhook ontvangen',    ok: true,  duration: '0.1s', bundles: 1 },
      { label: 'Kandidaten Ophalen',   ok: true,  duration: '1.2s', bundles: 92 },
      { label: 'Filter',               ok: true,  duration: '0.2s', bundles: 71 },
      { label: 'WhatsApp versturen',   ok: true,  duration: '1.3s', bundles: 71 },
    ],
  },
  {
    id: 3, ts: '10 jun 08:00', ok: false, duration: '0.9s',
    operations: 2, bundles: 0,
    error: 'API timeout bij Diensten Ophalen',
    steps: [
      { label: 'Webhook ontvangen',    ok: true,  duration: '0.1s', bundles: 1 },
      { label: 'Diensten Ophalen',     ok: false, duration: '0.8s', bundles: 0, error: 'Request timeout na 800ms' },
    ],
  },
  {
    id: 4, ts: '9 jun 08:00', ok: true, duration: '3.5s',
    operations: 11, bundles: 78,
    steps: [
      { label: 'Webhook ontvangen',    ok: true,  duration: '0.1s', bundles: 1 },
      { label: 'Kandidaten Ophalen',   ok: true,  duration: '1.6s', bundles: 78 },
      { label: 'Filter',               ok: true,  duration: '0.3s', bundles: 55 },
      { label: 'WhatsApp versturen',   ok: true,  duration: '1.5s', bundles: 55 },
    ],
  },
]

function LogsPanel({ onClose }) {
  const [expanded, setExpanded] = useState(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <List size={14} color="var(--color-primary)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Uitvoeringen</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' }}>
          <X size={15} />
        </button>
      </div>

      {/* Log list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {MOCK_LOGS.map(log => {
          const isOpen = expanded === log.id
          return (
            <div key={log.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
              {/* Row */}
              <button type="button"
                onClick={() => setExpanded(isOpen ? null : log.id)}
                style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', gap: 8, textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                {log.ok
                  ? <CheckCircle size={13} color="var(--color-success)" style={{ flexShrink: 0 }} />
                  : <AlertCircle size={13} color="var(--color-danger)" style={{ flexShrink: 0 }} />
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: log.ok ? '#111827' : 'var(--color-danger)' }}>
                      {log.ok ? 'Geslaagd' : 'Mislukt'}
                    </span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{log.duration}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                    {log.ts} · {log.operations} operaties · {log.bundles} bundles
                  </div>
                  {!log.ok && log.error && (
                    <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 2 }}>{log.error}</div>
                  )}
                </div>
                <ChevronDown size={12} color="#D1D5DB"
                  style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>

              {/* Expanded steps */}
              {isOpen && (
                <div style={{ padding: '0 16px 12px 36px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {log.steps.map((step, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: step.ok ? 'var(--color-success)' : 'var(--color-danger)', marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 11, fontWeight: 500, color: '#374151' }}>{step.label}</span>
                          <span style={{ fontSize: 11, color: '#9CA3AF' }}>{step.duration}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#6B7280' }}>
                          {step.ok ? `${step.bundles} bundles` : step.error}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Inner editor ──────────────────────────────────────────────────────────────

function EditorInner({ workflow, onClose, onSave }) {
  const initFlow = stepsToFlow(
    (workflow.steps || []).map(s => ({ ...s, id: s.id || uid() }))
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initFlow.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Defer edges until after nodes are mounted so handles exist in the DOM
  useEffect(() => {
    setEdges(initFlow.edges)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [name,           setName]           = useState(workflow.name)
  const [trigger,        setTrigger]        = useState(workflow.trigger)
  const [scheduleConfig, setScheduleConfig] = useState(workflow.trigger_config?.schedule ?? null)
  const [webhookId]                         = useState(workflow.trigger_config?.webhook_id ?? null)
  const [, setWebhooks]                      = useState([])
  const [status,         setStatus]         = useState(workflow.status || 'draft')
  const [saved,          setSaved]          = useState(false)
  const [running,        setRunning]        = useState(false)
  const [runningNodeId,  setRunningNodeId]  = useState(null)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [pickerState,    setPickerState]    = useState(null)
  const [showSchedule,   setShowSchedule]   = useState(false)
  const [widePanelActive, setWidePanelActive] = useState(false)

  useEffect(() => {
    import('../../lib/api').then(m => {
      m.default.get('/webhooks')
        .then(res => setWebhooks(res.data?.data ?? res.data ?? []))
        .catch(() => {})
    })
  }, [])
  const [showLogs,       setShowLogs]       = useState(false)
  const [filterState,    setFilterState]    = useState(null)
  const [outputState,    setOutputState]    = useState(null)

  // Stable callback passed via context — never touches edge objects
  const handleEdgeAdd = useCallback((edgeId) => {
    setPickerState({ edgeId })
  }, [])

  const handleEdgeDelete = useCallback((edgeId) => {
    setEdges(eds => eds.filter(e => e.id !== edgeId))
  }, [setEdges])

  const handleEdgeFilter = useCallback((edgeId) => {
    setFilterState({ edgeId })
  }, [])

  const saveEdgeFilter = useCallback((edgeId, filters) => {
    setEdges(eds => eds.map(e => e.id === edgeId ? { ...e, data: { ...e.data, filters } } : e))
  }, [setEdges])

  const handleNodeRun = useCallback(async (nodeId, data) => {
    const { default: api } = await import('../../lib/api')
    let output = null

    try {
      if (data.type === 'candidates') {
        // Entity module: only the "Ophalen" action reads; filters live in cfg.filters.
        const cfg = data.config ?? {}
        const params = { per_page: cfg.limit ?? 100 }
        // Translate a status condition into a query param (other filters: backend later).
        const statusCond = (cfg.filters?.conditions ?? []).find(c => c.field === 'status' && c.value)
        if (statusCond) params.status = statusCond.value
        const res = await api.get('/sm_candidates', { params })
        const rows = res.data?.data ?? res.data ?? []
        output = rows.slice(0, cfg.limit ?? 100)

      } else if (data.type === 'planning') {
        const res = await api.get('/shifts', { params: { per_page: 100 } }).catch(() => null)
        output = res?.data?.data ?? res?.data ?? []

      } else {
        // Generieke test-module call (backend mag dit implementeren)
        const res = await api.post('/workflows/test-module', { module_type: data.type, config: data.config })
        output = res.data?.output ?? res.data
      }
    } catch (err) {
      output = { error: err.response?.data?.message ?? err.message }
    }

    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, output } } : n))
    setOutputState({ nodeId, output })
  }, [setNodes])

  const onConnect = useCallback((params) => {
    setEdges(eds => {
      const targetAlreadyHasIncoming = eds.some(e => e.target === params.target)
      if (!targetAlreadyHasIncoming) {
        return addEdge({ ...params, type: 'addable' }, eds)
      }

      // Target already has an incoming edge → insert a router between them
      const routerId = uid()
      const existingIncoming = eds.filter(e => e.target === params.target)
      const otherEdges = eds.filter(e => e.target !== params.target)

      const newEdges = [
        ...otherEdges,
        // All previous sources now connect to router
        ...existingIncoming.map(e => mkEdge(e.source, routerId)),
        // New source also connects to router
        mkEdge(params.source, routerId),
        // Router connects to original target
        mkEdge(routerId, params.target),
      ]

      // Add router node at midpoint
      setNodes(nds => {
        const targetNode = nds.find(n => n.id === params.target)
        const sourceNode = nds.find(n => n.id === params.source)
        const x = targetNode ? targetNode.position.x - 220 : (sourceNode?.position.x ?? 300) + 220
        const y = targetNode ? targetNode.position.y : (sourceNode?.position.y ?? 180)
        const routerNode = {
          id: routerId, type: 'module',
          position: { x, y },
          data: { type: 'router', config: {} },
          width: NODE_W, height: NODE_H,
        }
        return [...nds, routerNode]
      })

      return newEdges
    })
  }, [setEdges, setNodes])

  const insertModule = useCallback((type, edgeId) => {
    const newId = uid()
    // Read current state snapshots to avoid stale closures
    setNodes(nds => {
      const lastNode = nds[nds.length - 1]
      if (edgeId) {
        // We need edges here — defer edge manipulation to separate call
        return nds
      }
      const x = lastNode ? lastNode.position.x + 220 : 80
      const y = lastNode ? lastNode.position.y : 180
      return [...nds, { id: newId, type: 'module', position: { x, y }, width: NODE_W, height: NODE_H, data: { type, config: {} } }]
    })

    if (edgeId) {
      // Batch node + edge update together using flushSync equivalent — just do them sequentially
      setEdges(eds => {
        const edge = eds.find(e => e.id === edgeId)
        if (!edge) return eds
        return [
          ...eds.filter(e => e.id !== edgeId),
          mkEdge(edge.source, newId),
          mkEdge(newId, edge.target),
        ]
      })
      setNodes(nds => {
        const edge    = edges.find(e => e.id === edgeId)
        if (!edge) return nds
        const srcNode = nds.find(n => n.id === edge.source)
        const tgtNode = nds.find(n => n.id === edge.target)
        const midX    = srcNode && tgtNode ? (srcNode.position.x + tgtNode.position.x) / 2 : 300
        const midY    = srcNode ? srcNode.position.y : 180
        return [
          ...nds.map(n =>
            n.position.x > (srcNode?.position.x ?? Infinity) && n.id !== edge.source
              ? { ...n, position: { ...n.position, x: n.position.x + 220 } }
              : n
          ),
          { id: newId, type: 'module', position: { x: midX, y: midY - 120 }, width: NODE_W, height: NODE_H, data: { type, config: {} } },
        ]
      })
    } else {
      setEdges(eds => {
        const nds = nodes  // snapshot via closure — acceptable here since this is user-triggered
        const lastNode = nds[nds.length - 1]
        if (!lastNode) return eds
        return [...eds, mkEdge(lastNode.id, newId)]
      })
    }

    setSelectedNodeId(newId)
  }, [setNodes, setEdges, edges, nodes])

  const updateNodeConfig = useCallback((nodeId, key, val) => {
    setNodes(nds => nds.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, config: { ...n.data.config, [key]: val } } } : n
    ))
  }, [setNodes])

  const deleteNode = useCallback((nodeId) => {
    setEdges(eds => {
      const inEdge  = eds.find(e => e.target === nodeId)
      const outEdge = eds.find(e => e.source === nodeId)
      const without = eds.filter(e => e.source !== nodeId && e.target !== nodeId)
      if (inEdge && outEdge) {
        return [...without, mkEdge(inEdge.source, outEdge.target)]
      }
      return without
    })
    setNodes(nds => nds.filter(n => n.id !== nodeId))
    setSelectedNodeId(id => id === nodeId ? null : id)
  }, [setEdges, setNodes])

  const handleSave = useCallback(() => {
    const steps = flowToSteps(nodes, edges)
    let triggerConfig = undefined
    if (trigger === 'Webhook' && webhookId) triggerConfig = { webhook_id: webhookId }
    else if (trigger === 'Scheduled' && scheduleConfig) triggerConfig = { schedule: scheduleConfig }
    onSave({ ...workflow, name, trigger, trigger_config: triggerConfig, status, steps })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [nodes, edges, workflow, name, trigger, scheduleConfig, webhookId, status, onSave])

  const handleRun = useCallback(async () => {
    setRunning(true)
    // Walk nodes in flow order, animate each
    const orderedNodes = []
    const visited = new Set()
    const startId = nodes.filter(n => !edges.some(e => e.target === n.id))
                         .sort((a, b) => a.position.x - b.position.x)[0]?.id
    let current = startId
    while (current && !visited.has(current)) {
      orderedNodes.push(current)
      visited.add(current)
      current = edges.find(e => e.source === current)?.target
    }
    for (const nid of orderedNodes) {
      setRunningNodeId(nid)
      await new Promise(r => setTimeout(r, 800))
    }
    setRunningNodeId(null)
    setRunning(false)
  }, [nodes, edges])

  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null

  const firstNodeId = nodes
    .filter(n => !edges.some(e => e.target === n.id))
    .sort((a, b) => a.position.x - b.position.x)[0]?.id

  const nodesWithFirst = nodes.map(n => ({
    ...n,
    data: { ...n.data, isFirst: n.id === firstNodeId, isRunning: n.id === runningNodeId },
  }))

  return (
    <EdgeAddContext.Provider value={handleEdgeAdd}>
    <EdgeDeleteContext.Provider value={handleEdgeDelete}>
    <EdgeFilterContext.Provider value={handleEdgeFilter}>
    <NodeRunContext.Provider value={handleNodeRun}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: '#F5F5F7' }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          height: 56, padding: '0 20px', flexShrink: 0,
          background: 'white', borderBottom: '1px solid #F3F4F6',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--color-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={15} color="var(--color-primary)" />
            </div>
            <input
              value={name} onChange={e => setName(e.target.value)}
              style={{ fontSize: 14, fontWeight: 600, color: '#111827', border: 'none', background: 'transparent', outline: 'none', minWidth: 60, maxWidth: 240 }}
            />
          </div>

          <div style={{ width: 1, height: 20, background: '#E5E7EB', flexShrink: 0 }} />

          <button onClick={() => setShowSchedule(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8,
              border: '1px solid #E5E7EB', background: '#F9FAFB', cursor: 'pointer',
              fontSize: 12, color: '#374151', fontWeight: 500,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
            onMouseLeave={e => (e.currentTarget.style.background = '#F9FAFB')}>
            <Clock size={13} color="#9CA3AF" />
            {scheduleLabel(trigger, scheduleConfig)}
          </button>

          <div style={{ width: 1, height: 20, background: '#E5E7EB', flexShrink: 0 }} />

          <button onClick={() => setStatus(s => s === 'active' ? 'inactive' : 'active')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999,
              background: status === 'active' ? '#F0FDF4' : '#F9FAFB',
              color:      status === 'active' ? 'var(--color-success)' : '#9CA3AF',
              border:     `1px solid ${status === 'active' ? '#BBF7D0' : '#E5E7EB'}`,
              cursor: 'pointer', fontSize: 11, fontWeight: 500,
            }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: status === 'active' ? 'var(--color-success)' : '#D1D5DB' }} />
            {status === 'active' ? 'Actief' : 'Inactief'}
          </button>

          <div style={{ flex: 1 }} />

          <button onClick={() => setShowLogs(s => !s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: showLogs ? 'var(--color-primary-bg)' : '#F9FAFB',
              color:      showLogs ? 'var(--color-primary)'    : '#6B7280',
              border:     `1px solid ${showLogs ? 'var(--color-primary)' : '#E5E7EB'}`,
              cursor: 'pointer',
            }}>
            <List size={13} />
            Logs
          </button>

          <button onClick={handleRun} disabled={running}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: running ? '#F3F4F6' : 'var(--color-primary-bg)',
              color:      running ? '#9CA3AF' : 'var(--color-primary)',
              border: 'none', cursor: running ? 'not-allowed' : 'pointer',
            }}>
            {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {running ? 'Bezig...' : 'Uitvoeren'}
          </button>

          <button onClick={handleSave}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: saved ? 'var(--color-success)' : 'var(--color-primary)',
              color: 'white', border: 'none', cursor: 'pointer', transition: 'background 0.2s',
            }}>
            <Save size={13} />
            {saved ? 'Opgeslagen!' : 'Opslaan'}
          </button>

          <button onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#9CA3AF' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <X size={15} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Canvas */}
          <div style={{ flex: 1, position: 'relative' }}>
            <ReactFlow
              nodes={nodesWithFirst}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={NODE_TYPES}
              edgeTypes={EDGE_TYPES}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              deleteKeyCode={['Backspace', 'Delete']}
              fitView
              fitViewOptions={{ padding: 0.35 }}
              minZoom={0.3}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#E5E7EB" gap={20} />
              <Controls position="bottom-left" showInteractive={false} />
              <MiniMap
                nodeColor={n => MODULE_META[n.data?.type]?.color ?? '#D1D5DB'}
                nodeStrokeWidth={0}
                style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}
              />
            </ReactFlow>

            {/* Floating add button */}
            <button
              onClick={() => setPickerState({ append: true })}
              style={{
                position: 'absolute', bottom: 24, right: 24,
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 16px', borderRadius: 999,
                background: 'var(--color-primary)', color: 'white',
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                zIndex: 10,
              }}>
              <Plus size={15} />
              Module toevoegen
            </button>
          </div>

          {/* Right panel — widens when management tabs (Agents/Prompts/FAQ/etc.) are active */}
          <div style={{ width: widePanelActive ? 560 : 280, flexShrink: 0, background: 'white', borderLeft: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width 0.2s ease' }}>
            {showLogs
              ? <LogsPanel onClose={() => setShowLogs(false)} />
              : <ConfigPanel node={selectedNode} onUpdate={updateNodeConfig} onDelete={deleteNode}
                  onTabChange={tab => setWidePanelActive(MANAGE_TABS.includes(tab))} />
            }
          </div>
        </div>

        {/* Schedule modal */}
        {showSchedule && (
          <ScheduleModal
            trigger={trigger}
            scheduleConfig={scheduleConfig}
            onSave={(newTrigger, newCfg) => {
              setTrigger(newTrigger)
              setScheduleConfig(newCfg)
              setShowSchedule(false)
            }}
            onClose={() => setShowSchedule(false)}
          />
        )}

        {/* Module picker */}
        {pickerState && (
          <ModulePicker
            insertAfterEdgeId={pickerState.edgeId ?? null}
            onSelect={insertModule}
            onClose={() => setPickerState(null)}
          />
        )}
        {filterState && (
          <EdgeFilterPanel
            edgeId={filterState.edgeId}
            filters={edges.find(e => e.id === filterState.edgeId)?.data?.filters}
            onClose={() => setFilterState(null)}
            onSave={(filters) => saveEdgeFilter(filterState.edgeId, filters)}
          />
        )}
        {outputState && (
          <OutputPanel
            nodeId={outputState.nodeId}
            output={outputState.output}
            onClose={() => setOutputState(null)}
          />
        )}
      </div>
    </NodeRunContext.Provider>
    </EdgeFilterContext.Provider>
    </EdgeDeleteContext.Provider>
    </EdgeAddContext.Provider>
  )
}

// ── Public export wrapped in ReactFlowProvider ────────────────────────────────

export default function WorkflowCanvasEditor(props) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  )
}
