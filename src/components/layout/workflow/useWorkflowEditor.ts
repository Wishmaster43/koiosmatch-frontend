/**
 * useWorkflowEditor — all editor state + behaviour for WorkflowCanvasEditor:
 * the ReactFlow nodes/edges, the trigger/schedule/status fields, selection, the
 * picker/filter/output panels, and every graph mutation (connect/insert/delete/
 * filter) + save/run. Extracted from the component so the editor stays declarative
 * (logic in a hook, §3). Returns the state + handlers the JSX consumes.
 */
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { addEdge, useNodesState, useEdgesState } from '@xyflow/react'
import type { Connection } from '@xyflow/react'
import { uid, mkEdge, NODE_W, NODE_H, stepsToFlow, flowToSteps } from './serialization'
import { useWorkflowRunControl } from './useWorkflowRunControl'
import { useOutputSeeding } from './useOutputSeeding'
import { buildVarFields, computeWorkflowSnapshot } from './workflowEditorUtils'
import type { Workflow, FlowNode, FlowEdge, FlowNodeData, EdgeFilters, ScheduleConfig,
  WorkflowVarGroup } from '@/types/workflow'
import { unwrapList } from '@/lib/api'

// Pure helpers extracted to workflowEditorUtils (§3, split at ~400 lines); re-exported
// here so existing test imports (`from './useWorkflowEditor'`) keep working unchanged.
export { flattenSample, buildVarFields, computeWorkflowSnapshot } from './workflowEditorUtils'

export function useWorkflowEditor({ workflow, onSave, initialRunId = null }: {
  workflow: Workflow
  onSave: (updated: Workflow, closeAfter?: boolean) => void
  // RUN-CONTROL-1: open the editor already focused on an active run (the 409
  // "already running" path from the list page) — the logs panel opens on it.
  initialRunId?: string | number | null
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

  // Trigger config is opaque on the workflow; narrow it to the shapes we read.
  const triggerConfig = workflow.trigger_config as {
    schedule?: ScheduleConfig | null; webhook_id?: string | number | null; event?: string; agent?: string
  } | undefined

  // Reload seeding: the backend persists 'event'/'agent' flat on trigger_config (not
  // nested under 'schedule'), so a reloaded Event/Webhook(agent) trigger rebuilds its
  // ScheduleConfig here — otherwise a same-page reload + immediate re-save would wipe
  // the binding (nextTriggerConfig falls through to undefined; the exact class of bug
  // this whole trigger_config branch order guards against).
  const initialScheduleConfig: ScheduleConfig | null = triggerConfig?.schedule
    ?? (triggerConfig?.event ? { schedule_type: 'event', event: triggerConfig.event } : null)
    ?? (triggerConfig?.agent ? { schedule_type: 'webhook', agent: triggerConfig.agent } : null)

  const [name,           setName]           = useState(workflow.name)
  const [trigger,        setTrigger]        = useState(workflow.trigger)
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig | null>(initialScheduleConfig)
  const [webhookId]                         = useState<string | number | null>(triggerConfig?.webhook_id ?? null)
  const [, setWebhooks]                      = useState<unknown[]>([])

  // Dirty-check baseline (item 19): the snapshot right after load, computed via the
  // SAME serializer as the live snapshot below, so a freshly-opened workflow never
  // reads as dirty from a round-trip shape mismatch. Updated after every save.
  const savedSnapshotRef = useRef(
    computeWorkflowSnapshot(initFlow.nodes, initFlow.edges, workflow.name, workflow.trigger,
      initialScheduleConfig, triggerConfig?.webhook_id ?? null, workflow.status || 'draft'),
  )
  const [status,         setStatus]         = useState(workflow.status || 'draft')
  const [saved,          setSaved]          = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [pickerState,    setPickerState]    = useState<{ edgeId?: string; append?: boolean } | null>(null)
  const [showSchedule,   setShowSchedule]   = useState(false)
  const [widePanelActive, setWidePanelActive] = useState(false)
  // null = auto (node without incoming edge, leftmost); set via START badge drag
  const [startNodeId,    setStartNodeId]    = useState<string | null>(null)

  useEffect(() => {
    import('@/lib/api').then(m => {
      m.default.get('/webhooks')
        .then(res => setWebhooks(unwrapList(res).rows))
        .catch(() => {})
    })
  }, [])
  const [showLogs,       setShowLogs]       = useState(initialRunId != null)
  const [filterState,    setFilterState]    = useState<{ edgeId: string } | null>(null)
  const [outputState,    setOutputState]    = useState<{ nodeId: string; output: unknown } | null>(null)

  // Reveal the logs/run-viewer panel whenever a run starts (or hits a 409
  // conflict) — kept stable so the run-control hook's handleRun identity doesn't churn.
  const openLogsOnRun = useCallback(() => setShowLogs(true), [])

  // Run lifecycle (start/stop/poll/409-conflict) — extracted to its own hook
  // (§3, split at ~400 lines) since this composer stays focused on graph state.
  const {
    running, runError, setRunError, runningNodeId,
    activeRunId, liveRun, liveRunActive, runConflict, handleStopped, handleRun,
  } = useWorkflowRunControl({ workflowId: workflow.id, initialRunId, onRunStarted: openLogsOnRun })

  // Run-viewer output-seeding (extracted hook): once the polled run is terminal,
  // copies each step's output onto its matching node so the VariablePicker and the
  // ConfigPanel "Uitvoering" tab (OutputTree) get real data instead of only whatever
  // a manual per-node test-run produced.
  useOutputSeeding(liveRun, setNodes)

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

  const saveEdgeFilter = useCallback((edgeId: string, filters: EdgeFilters, label: string) => {
    setEdges(eds => eds.map(e => e.id === edgeId ? { ...e, data: { ...e.data, filters, label: label || undefined } } : e))
  }, [setEdges])

  const handleNodeRun = useCallback(async (nodeId: string, data: FlowNodeData) => {
    const { default: api } = await import('@/lib/api')
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
        const rows = unwrapList<Record<string, unknown>>(res).rows
        output = rows.slice(0, cfg.limit ?? 100)

      } else if (data.type === 'planning') {
        const res = await api.get('/planning/shifts', { params: { per_page: 100 } }).catch(() => null)
        // `res` can be null (the .catch above) — unwrapList requires a real
        // response, so guard it explicitly (was `res?.data?.data ?? res?.data ?? []`).
        output = res ? unwrapList(res).rows : []

      } else {
        // Generic module test-run — backend POST /workflows/test-module (G-9): previews the
        // module's output; 422 for an unknown or non-testable (really-sends) module type.
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
    let nextTriggerConfig: Record<string, unknown> | undefined = undefined
    // Same branch order as computeWorkflowSnapshot — agent flavor first (see there).
    if (trigger === 'Webhook' && scheduleConfig?.agent) nextTriggerConfig = { agent: scheduleConfig.agent }
    else if (trigger === 'Webhook' && webhookId) nextTriggerConfig = { webhook_id: webhookId }
    else if (trigger === 'Scheduled' && scheduleConfig) nextTriggerConfig = { schedule: scheduleConfig }
    // Event trigger (BIRTHDAY-FLOW-2): trigger_config carries only the event key,
    // matching the backend contract (Workflow::trigger_config['event']).
    else if (trigger === 'Event' && scheduleConfig?.event) nextTriggerConfig = { event: scheduleConfig.event }
    onSave({ ...workflow, name, trigger, trigger_config: nextTriggerConfig, status, steps }, closeAfter)
    // A save just persisted the current state — it's the new dirty-check baseline.
    savedSnapshotRef.current = computeWorkflowSnapshot(nodes, edges, name, trigger, scheduleConfig, webhookId, status)
    if (!closeAfter) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }, [nodes, edges, workflow, name, trigger, scheduleConfig, webhookId, status, onSave])

  // Dirty-check (item 19): true when the live graph/name/trigger/schedule/status
  // differ from the last-saved baseline — serialize-compare via the shared
  // computeWorkflowSnapshot so it stays cheap and never drifts from handleSave.
  const isDirty = useCallback(
    () => computeWorkflowSnapshot(nodes, edges, name, trigger, scheduleConfig, webhookId, status) !== savedSnapshotRef.current,
    [nodes, edges, name, trigger, scheduleConfig, webhookId, status],
  )

  // Variables a node may reference: the output fields of every upstream module.
  // Walks edges backward (BFS), orders ancestors left-to-right, and derives
  // insertable {{node.field}} tokens from each one's last test-run output.
  const getUpstreamVariables = useCallback((nodeId?: string | null): WorkflowVarGroup[] => {
    if (!nodeId) return []
    const ancestors: string[] = []
    const seen = new Set<string>([nodeId])
    let frontier = edges.filter(e => e.target === nodeId).map(e => e.source)
    while (frontier.length) {
      const next: string[] = []
      for (const src of frontier) {
        if (seen.has(src)) continue
        seen.add(src)
        ancestors.push(src)
        edges.filter(e => e.target === src).forEach(e => next.push(e.source))
      }
      frontier = next
    }
    return ancestors
      .map(id => nodes.find(n => n.id === id))
      .filter((n): n is FlowNode => !!n)
      .sort((a, b) => a.position.x - b.position.x)
      .map(n => ({
        nodeId: n.id,
        moduleType: n.data.type ?? '',
        customName: (n.data.config as Record<string, unknown> | undefined)?.naam as string | undefined,
        hasRun: n.data.output != null,
        fields: buildVarFields(n.id, n.data.output),
      }))
  }, [nodes, edges])

  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null

  // Manual start takes precedence; fall back to leftmost node without incoming edge
  const autoFirstNodeId = nodes
    .filter(n => !edges.some(e => e.target === n.id))
    .sort((a, b) => a.position.x - b.position.x)[0]?.id
  const firstNodeId = (startNodeId && nodes.some(n => n.id === startNodeId))
    ? startNodeId
    : autoFirstNodeId

  // WF-R3: map the polled run's steps (step_id → status) onto the nodes so the
  // canvas shows real per-step progress (running/success/failed) live.
  // NODE-PROGRESS-1 (Danny 23-07): also carry the live {done,total} loop progress
  // + the finished item count, so the node ring renders a Make-style progress arc
  // with a counter badge ("38") instead of only a glow.
  const stepLive = useMemo(() => {
    const status: Record<string, string> = {}
    const progress: Record<string, { done: number; total: number }> = {}
    const itemsTotal: Record<string, number> = {}
    ;(liveRun?.steps ?? []).forEach(s => {
      const id = s.step_id != null ? String(s.step_id) : undefined
      if (!id) return
      if (s.status) status[id] = String(s.status)
      if (s.progress && s.progress.total > 0) progress[id] = s.progress
      if (typeof s.items_total === 'number') itemsTotal[id] = s.items_total
    })
    return { status, progress, itemsTotal }
  }, [liveRun])

  const nodesWithFirst = nodes.map(n => ({
    ...n,
    data: {
      ...n.data,
      isFirst: n.id === firstNodeId,
      isRunning: n.id === runningNodeId || stepLive.status[n.id] === 'running',
      status: stepLive.status[n.id],
      progress: stepLive.progress[n.id] ?? null,
      itemsTotal: stepLive.itemsTotal[n.id] ?? null,
    },
  }))

  return {
    edges, onNodesChange, onEdgesChange, onConnect, nodesWithFirst, selectedNode, setSelectedNodeId,
    name, setName, trigger, setTrigger, scheduleConfig, setScheduleConfig, status, setStatus,
    saved, running, runError, setRunError, showSchedule, setShowSchedule, widePanelActive, setWidePanelActive, showLogs, setShowLogs,
    liveRun, activeRunId, liveRunActive, runConflict, handleStopped,
    pickerState, setPickerState, filterState, setFilterState, outputState, setOutputState,
    firstNodeId, setStartNodeId, getUpstreamVariables,
    handleEdgeAdd, handleEdgeDelete, handleEdgeFilter, saveEdgeFilter, handleNodeRun,
    insertModule, updateNodeConfig, deleteNode, handleSave, handleRun, isDirty,
  }
}
