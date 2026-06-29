/**
 * WorkflowCanvasEditor — the visual drag-and-drop workflow builder.
 *
 * Renders the node graph (via @xyflow/react / ReactFlow): the canvas, nodes,
 * connecting edges, minimap and controls. Owns the editor state (nodes/edges,
 * save/run, selection) and composes the side panels. The panels themselves live
 * in `./workflow/`:
 *   - ModulePicker → lists modules, filtered by which apps are enabled
 *   - ConfigPanel  → configures the selected module (settings/output/AI tabs)
 *   - LogsPanel    → the workflow's run history
 *   - fields / canvas / ScheduleModal / serialization → field inputs, node/edge
 *     components, the schedule modal and the steps↔flow round-trip.
 */
import { useState, useCallback, useEffect } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  ReactFlowProvider,
} from '@xyflow/react'
import type { Connection, NodeTypes, EdgeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { X, Save, Play, Loader2, Plus, Zap, List, Clock } from 'lucide-react'
import { MODULE_META } from '@/modules/index'
import { uid, mkEdge, NODE_W, NODE_H, stepsToFlow, flowToSteps } from './workflow/serialization'
import { ScheduleModal, scheduleLabel } from './workflow/ScheduleModal'
import { EdgeAddContext, EdgeDeleteContext, EdgeFilterContext, NodeRunContext, StartContext } from './workflow/contexts'
import { EdgeFilterPanel, OutputPanel, NODE_TYPES, EDGE_TYPES } from './workflow/canvas'
import ModulePicker from './workflow/ModulePicker'
import ConfigPanel, { MANAGE_TABS } from './workflow/ConfigPanel'
import LogsPanel from './workflow/LogsPanel'
import type { Workflow, FlowNode, FlowEdge, FlowNodeData, EdgeFilters, ScheduleConfig } from '@/types/workflow'

// ── Inner editor ──────────────────────────────────────────────────────────────

function EditorInner({ workflow, onClose, onSave }: {
  workflow: Workflow
  onClose: () => void
  onSave: (updated: Workflow, closeAfter?: boolean) => void
}) {
  const initFlow = stepsToFlow(
    (workflow.steps || []).map(s => ({ ...s, id: s.id || uid() }))
  )

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initFlow.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([])

  // Defer edges until after nodes are mounted so handles exist in the DOM
  useEffect(() => {
    setEdges(initFlow.edges)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Trigger config is opaque on the workflow; narrow it to the two shapes we read.
  const triggerConfig = workflow.trigger_config as { schedule?: ScheduleConfig | null; webhook_id?: string | number | null } | undefined

  const [name,           setName]           = useState(workflow.name)
  const [trigger,        setTrigger]        = useState(workflow.trigger)
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig | null>(triggerConfig?.schedule ?? null)
  const [webhookId]                         = useState<string | number | null>(triggerConfig?.webhook_id ?? null)
  const [, setWebhooks]                      = useState<unknown[]>([])
  const [status,         setStatus]         = useState(workflow.status || 'draft')
  const [saved,          setSaved]          = useState(false)
  const [running,        setRunning]        = useState(false)
  const [runningNodeId,  setRunningNodeId]  = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [pickerState,    setPickerState]    = useState<{ edgeId?: string; append?: boolean } | null>(null)
  const [showSchedule,   setShowSchedule]   = useState(false)
  const [widePanelActive, setWidePanelActive] = useState(false)
  // null = auto (node without incoming edge, leftmost); set via START badge drag
  const [startNodeId,    setStartNodeId]    = useState<string | null>(null)

  useEffect(() => {
    import('../../lib/api').then(m => {
      m.default.get('/webhooks')
        .then(res => setWebhooks(res.data?.data ?? res.data ?? []))
        .catch(() => {})
    })
  }, [])
  const [showLogs,       setShowLogs]       = useState(false)
  const [filterState,    setFilterState]    = useState<{ edgeId: string } | null>(null)
  const [outputState,    setOutputState]    = useState<{ nodeId: string; output: unknown } | null>(null)

  // Stable callback passed via context — never touches edge objects
  const handleEdgeAdd = useCallback((edgeId: string) => {
    setPickerState({ edgeId })
  }, [])

  const handleEdgeDelete = useCallback((edgeId: string) => {
    setEdges(eds => eds.filter(e => e.id !== edgeId))
  }, [setEdges])

  const handleEdgeFilter = useCallback((edgeId: string) => {
    setFilterState({ edgeId })
  }, [])

  const saveEdgeFilter = useCallback((edgeId: string, filters: EdgeFilters) => {
    setEdges(eds => eds.map(e => e.id === edgeId ? { ...e, data: { ...e.data, filters } } : e))
  }, [setEdges])

  const handleNodeRun = useCallback(async (nodeId: string, data: FlowNodeData) => {
    const { default: api } = await import('../../lib/api')
    let output: unknown = null

    try {
      if (data.type === 'candidates') {
        // Entity module: only the "Ophalen" action reads; filters live in cfg.filters.
        const cfg = (data.config ?? {}) as { limit?: number; filters?: EdgeFilters }
        const params: Record<string, unknown> = { per_page: cfg.limit ?? 100 }
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
      const e = err as { response?: { data?: { message?: string } }; message?: string }
      output = { error: e.response?.data?.message ?? e.message }
    }

    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, output } } : n))
    setOutputState({ nodeId, output })
  }, [setNodes])

  const onConnect = useCallback((params: Connection) => {
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
        const routerNode: FlowNode = {
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

  const insertModule = useCallback((type: string, edgeId: string | null) => {
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

  const updateNodeConfig = useCallback((nodeId: string, key: string, val: unknown) => {
    setNodes(nds => nds.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, config: { ...n.data.config, [key]: val } } } : n
    ))
  }, [setNodes])

  const deleteNode = useCallback((nodeId: string) => {
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

  const handleSave = useCallback((closeAfter = false) => {
    const steps = flowToSteps(nodes, edges)
    let triggerConfig: Record<string, unknown> | undefined = undefined
    if (trigger === 'Webhook' && webhookId) triggerConfig = { webhook_id: webhookId }
    else if (trigger === 'Scheduled' && scheduleConfig) triggerConfig = { schedule: scheduleConfig }
    onSave({ ...workflow, name, trigger, trigger_config: triggerConfig, status, steps }, closeAfter)
    if (!closeAfter) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }, [nodes, edges, workflow, name, trigger, scheduleConfig, webhookId, status, onSave])

  const handleRun = useCallback(async () => {
    setRunning(true)
    // Walk nodes in flow order, animate each
    const orderedNodes: string[] = []
    const visited = new Set<string>()
    const startId = nodes.filter(n => !edges.some(e => e.target === n.id))
                         .sort((a, b) => a.position.x - b.position.x)[0]?.id
    let current: string | undefined = startId
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

  // Manual start takes precedence; fall back to leftmost node without incoming edge
  const autoFirstNodeId = nodes
    .filter(n => !edges.some(e => e.target === n.id))
    .sort((a, b) => a.position.x - b.position.x)[0]?.id
  const firstNodeId = (startNodeId && nodes.some(n => n.id === startNodeId))
    ? startNodeId
    : autoFirstNodeId

  const nodesWithFirst = nodes.map(n => ({
    ...n,
    data: { ...n.data, isFirst: n.id === firstNodeId, isRunning: n.id === runningNodeId },
  }))

  return (
    <StartContext.Provider value={{ startNodeId: firstNodeId ?? null, setStartNodeId }}>
    <EdgeAddContext.Provider value={handleEdgeAdd}>
    <EdgeDeleteContext.Provider value={handleEdgeDelete}>
    <EdgeFilterContext.Provider value={handleEdgeFilter}>
    <NodeRunContext.Provider value={handleNodeRun}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: '#F5F5F7' }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          height: 56, padding: '0 20px', flexShrink: 0,
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--color-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={15} color="var(--color-primary)" />
            </div>
            <input
              value={name} onChange={e => setName(e.target.value)}
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', border: 'none', background: 'transparent', outline: 'none', minWidth: 60, maxWidth: 240 }}
            />
          </div>

          <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

          <button onClick={() => setShowSchedule(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--hover-bg)', cursor: 'pointer',
              fontSize: 12, color: 'var(--text)', fontWeight: 500,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--hover-bg)')}>
            <Clock size={13} color="var(--text-muted)" />
            {scheduleLabel(trigger, scheduleConfig)}
          </button>

          <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

          <button onClick={() => setStatus(s => s === 'active' ? 'inactive' : 'active')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999,
              background: status === 'active' ? 'var(--color-success-bg)' : 'var(--hover-bg)',
              color:      status === 'active' ? 'var(--color-success)' : 'var(--text-muted)',
              border:     `1px solid ${status === 'active' ? '#BBF7D0' : 'var(--border)'}`,
              cursor: 'pointer', fontSize: 11, fontWeight: 500,
            }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: status === 'active' ? 'var(--color-success)' : 'var(--border)' }} />
            {status === 'active' ? 'Actief' : 'Inactief'}
          </button>

          <div style={{ flex: 1 }} />

          <button onClick={() => setShowLogs(s => !s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: showLogs ? 'var(--color-primary-bg)' : 'var(--hover-bg)',
              color:      showLogs ? 'var(--color-primary)'    : 'var(--text-muted)',
              border:     `1px solid ${showLogs ? 'var(--color-primary)' : 'var(--border)'}`,
              cursor: 'pointer',
            }}>
            <List size={13} />
            Logs
          </button>

          <button onClick={handleRun} disabled={running}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: running ? 'var(--border)' : 'var(--color-primary-bg)',
              color:      running ? 'var(--text-muted)' : 'var(--color-primary)',
              border: 'none', cursor: running ? 'not-allowed' : 'pointer',
            }}>
            {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {running ? 'Bezig...' : 'Uitvoeren'}
          </button>

          {/* Opslaan — blijft in editor */}
          <button onClick={() => handleSave(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: saved ? 'var(--color-success-bg)' : 'var(--hover-bg)',
              color: saved ? 'var(--color-success)' : 'var(--text)',
              border: `1px solid ${saved ? 'var(--color-success)' : 'var(--border)'}`,
              cursor: 'pointer', transition: 'background 0.2s',
            }}>
            <Save size={13} />
            {saved ? 'Opgeslagen!' : 'Opslaan'}
          </button>

          {/* Opslaan & sluiten — terug naar overzicht */}
          <button onClick={() => handleSave(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: 'var(--color-primary)', color: 'white',
              border: 'none', cursor: 'pointer',
            }}>
            <Save size={13} />
            Opslaan &amp; sluiten
          </button>

          <button onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            title="Sluiten zonder opslaan">
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
              nodeTypes={NODE_TYPES as unknown as NodeTypes}
              edgeTypes={EDGE_TYPES as unknown as EdgeTypes}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              deleteKeyCode={['Backspace', 'Delete']}
              fitView
              fitViewOptions={{ padding: 0.35 }}
              minZoom={0.3}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="var(--border)" gap={20} />
              <Controls position="bottom-left" showInteractive={false} />
              <MiniMap
                nodeColor={n => MODULE_META[(n.data?.type as string) ?? '']?.color ?? 'var(--border)'}
                nodeStrokeWidth={0}
                style={{ borderRadius: 10, border: '1px solid var(--border)' }}
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
          <div style={{ width: widePanelActive ? 560 : 280, flexShrink: 0, background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width 0.2s ease' }}>
            {showLogs
              ? <LogsPanel workflowId={workflow.id} onClose={() => setShowLogs(false)} />
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
            filters={edges.find(e => e.id === filterState.edgeId)?.data?.filters as EdgeFilters | null | undefined}
            onClose={() => setFilterState(null)}
            onSave={(filters) => saveEdgeFilter(filterState.edgeId, filters)}
          />
        )}
        {outputState && (
          <OutputPanel
            output={outputState.output}
            onClose={() => setOutputState(null)}
          />
        )}
      </div>
    </NodeRunContext.Provider>
    </EdgeFilterContext.Provider>
    </EdgeDeleteContext.Provider>
    </EdgeAddContext.Provider>
    </StartContext.Provider>
  )
}

// ── Public export wrapped in ReactFlowProvider ────────────────────────────────

export default function WorkflowCanvasEditor(props: {
  workflow: Workflow
  onClose: () => void
  onSave: (updated: Workflow, closeAfter?: boolean) => void
}) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  )
}
