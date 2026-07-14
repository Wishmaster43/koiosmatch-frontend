/**
 * useWorkflowEditor — all editor state + behaviour for WorkflowCanvasEditor:
 * the ReactFlow nodes/edges, the trigger/schedule/status fields, selection, the
 * picker/filter/output panels, and every graph mutation (connect/insert/delete/
 * filter) + save/run. Extracted from the component so the editor stays declarative
 * (logic in a hook, §3). Returns the state + handlers the JSX consumes.
 */
import { useState, useCallback, useEffect, useMemo } from 'react'
import { addEdge, useNodesState, useEdgesState } from '@xyflow/react'
import type { Connection } from '@xyflow/react'
import { uid, mkEdge, NODE_W, NODE_H, stepsToFlow, flowToSteps } from './serialization'
import { useWorkflowRun } from './useWorkflowRun'
import { useOutputSeeding } from './useOutputSeeding'
import type { Workflow, FlowNode, FlowEdge, FlowNodeData, EdgeFilters, ScheduleConfig,
  WorkflowVarField, WorkflowVarGroup } from '@/types/workflow'

// Flatten a test-run sample into dot-paths (max depth 2, capped) for the var
// picker. An array is represented by the shape of its first element.
// Exported for unit testing.
export function flattenSample(obj: unknown, prefix = '', depth = 0): Array<{ path: string; sample: string }> {
  if (obj == null) return []
  if (typeof obj !== 'object') return prefix ? [{ path: prefix, sample: String(obj) }] : []
  if (Array.isArray(obj)) return obj.length ? flattenSample(obj[0], prefix, depth) : []
  const out: Array<{ path: string; sample: string }> = []
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v) && depth < 1) {
      out.push(...flattenSample(v, path, depth + 1))
    } else {
      out.push({ path, sample: Array.isArray(v) ? `[${v.length}]` : v == null ? '' : String(v) })
    }
    if (out.length > 60) break
  }
  return out
}

// Build the insertable variable fields for one node's output (pure; unit-tested).
// Bundle expansion (CMBE 2026-07-09, Danny blocked on picking): a LIST output field
// (candidates [8]) runs PER ITEM in send-modules, so item[0]'s keys are the valid
// placeholders — exposed as flat {{field}} tokens (dot-paths like user.email via
// flattenSample). The list summary row is dropped; duplicate names dedupe by token.
// Scalar fields keep the node-scoped {{node.field}} token; no run → whole-output token.
export function buildVarFields(nodeId: string, out: unknown): WorkflowVarField[] {
  const hasRun = out != null
  const flat = hasRun ? flattenSample(out) : []
  const bundleFields: WorkflowVarField[] = []
  const bundleKeys = new Set<string>()
  if (hasRun && out && typeof out === 'object') {
    const entries: Array<[string, unknown]> = Array.isArray(out) ? [['', out]] : Object.entries(out as Record<string, unknown>)
    const seenTokens = new Set<string>()
    for (const [k, v] of entries) {
      if (!Array.isArray(v) || !v.length || typeof v[0] !== 'object' || v[0] == null) continue
      bundleKeys.add(k)
      for (const f of flattenSample(v[0])) {
        const token = `{{${f.path}}}`
        if (seenTokens.has(token)) continue
        seenTokens.add(token)
        bundleFields.push({ token, label: f.path, sample: f.sample })
      }
    }
  }
  // A top-level array IS one bundle — no scalar duplicates then.
  const scalarFields = Array.isArray(out) ? [] : flat
    .filter(f => !bundleKeys.has(f.path))
    .map(f => ({ token: `{{${nodeId}.${f.path}}}`, label: f.path, sample: f.sample }))
  return (hasRun && (bundleFields.length || scalarFields.length))
    ? [...bundleFields, ...scalarFields]
    : [{ token: `{{${nodeId}}}`, label: '' }]
}

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
  const [runError,       setRunError]       = useState<string | null>(null)
  const [runningNodeId,  setRunningNodeId]  = useState<string | null>(null)
  // WF-R3: the id of the run we're polling live (set by handleRun), and its steps.
  const [activeRunId,    setActiveRunId]    = useState<string | number | null>(initialRunId)
  const liveRun = useWorkflowRun(activeRunId)
  // RUN-CONTROL-1: true after a 409 "already running" — the header shows the
  // i18n "loopt al" feedback while the logs panel points at that run.
  const [runConflict,    setRunConflict]    = useState(initialRunId != null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [pickerState,    setPickerState]    = useState<{ edgeId?: string; append?: boolean } | null>(null)
  const [showSchedule,   setShowSchedule]   = useState(false)
  const [widePanelActive, setWidePanelActive] = useState(false)
  // null = auto (node without incoming edge, leftmost); set via START badge drag
  const [startNodeId,    setStartNodeId]    = useState<string | null>(null)

  useEffect(() => {
    import('@/lib/api').then(m => {
      m.default.get('/webhooks')
        .then(res => setWebhooks(res.data?.data ?? res.data ?? []))
        .catch(() => {})
    })
  }, [])
  const [showLogs,       setShowLogs]       = useState(initialRunId != null)
  const [filterState,    setFilterState]    = useState<{ edgeId: string } | null>(null)
  const [outputState,    setOutputState]    = useState<{ nodeId: string; output: unknown } | null>(null)

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
        const rows = res.data?.data ?? res.data ?? []
        output = rows.slice(0, cfg.limit ?? 100)

      } else if (data.type === 'planning') {
        const res = await api.get('/planning/shifts', { params: { per_page: 100 } }).catch(() => null)
        output = res?.data?.data ?? res?.data ?? []

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
    if (trigger === 'Webhook' && webhookId) nextTriggerConfig = { webhook_id: webhookId }
    else if (trigger === 'Scheduled' && scheduleConfig) nextTriggerConfig = { schedule: scheduleConfig }
    onSave({ ...workflow, name, trigger, trigger_config: nextTriggerConfig, status, steps }, closeAfter)
    if (!closeAfter) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }, [nodes, edges, workflow, name, trigger, scheduleConfig, webhookId, status, onSave])

  const handleRun = useCallback(async () => {
    setRunning(true)
    setRunError(null)
    setRunConflict(false)
    try {
      // Actually execute the SAVED workflow server-side (the engine runs the
      // steps on the queue). This button used to only animate — never ran.
      const { default: api } = await import('@/lib/api')
      // Start the queued run and keep its id so we can poll the REAL per-step status
      // (WF-R3) — replaces the old fixed 800ms fake walk. Shape: { run: { id } }.
      const res = await api.post(`/workflows/${workflow.id}/run`)
      const runId = (res.data?.run?.id ?? res.data?.data?.id ?? res.data?.id) as string | number | undefined
      if (runId != null) setActiveRunId(runId)

      // Show the run history / live viewer (the polled run drives node colours).
      setShowLogs(true)
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { message?: string; run_id?: string | number } } }
      // RUN-CONTROL-1 single-flight: 409 = this workflow already has a live run.
      // Point the viewer at THAT run (poll + logs panel) and show "loopt al".
      if (e.response?.status === 409) {
        if (e.response.data?.run_id != null) setActiveRunId(e.response.data.run_id)
        setRunConflict(true)
        setShowLogs(true)
      } else {
        // Surface the backend reason (e.g. "Workflow is niet actief" on a draft);
        // empty string = generic message via i18n in the component.
        setRunError(e.response?.data?.message ?? '')
      }
    } finally {
      setRunningNodeId(null)
      setRunning(false)
    }
  }, [workflow.id])

  // RUN-CONTROL-1: the polled run can still be cancelled → show the stop button.
  const liveRunActive = liveRun != null && ['running', 'waiting'].includes(String(liveRun.status))

  // After a successful stop the conflict is over; the poll picks up `cancelled`.
  const handleStopped = useCallback(() => {
    setRunConflict(false)
    setRunError(null)
  }, [])

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
  const stepStatus = useMemo(() => {
    const m: Record<string, string> = {}
    ;(liveRun?.steps ?? []).forEach(s => {
      const id = s.step_id != null ? String(s.step_id) : undefined
      if (id && s.status) m[id] = String(s.status)
    })
    return m
  }, [liveRun])

  const nodesWithFirst = nodes.map(n => ({
    ...n,
    data: {
      ...n.data,
      isFirst: n.id === firstNodeId,
      isRunning: n.id === runningNodeId || stepStatus[n.id] === 'running',
      status: stepStatus[n.id],
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
    insertModule, updateNodeConfig, deleteNode, handleSave, handleRun,
  }
}
