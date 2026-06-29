/**
 * useWorkflowEditor — all editor state + behaviour for WorkflowCanvasEditor:
 * the ReactFlow nodes/edges, the trigger/schedule/status fields, selection, the
 * picker/filter/output panels, and every graph mutation (connect/insert/delete/
 * filter) + save/run. Extracted from the component so the editor stays declarative
 * (logic in a hook, §3). Returns the state + handlers the JSX consumes.
 */
import { useState, useCallback, useEffect } from 'react'
import { addEdge, useNodesState, useEdgesState } from '@xyflow/react'
import type { Connection } from '@xyflow/react'
import { uid, mkEdge, NODE_W, NODE_H, stepsToFlow, flowToSteps } from './serialization'
import type { Workflow, FlowNode, FlowEdge, FlowNodeData, EdgeFilters, ScheduleConfig } from '@/types/workflow'

export function useWorkflowEditor({ workflow, onSave }: {
  workflow: Workflow
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
    import('../../../lib/api').then(m => {
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
    const { default: api } = await import('../../../lib/api')
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

  return {
    edges, onNodesChange, onEdgesChange, onConnect, nodesWithFirst, selectedNode, setSelectedNodeId,
    name, setName, trigger, setTrigger, scheduleConfig, setScheduleConfig, status, setStatus,
    saved, running, showSchedule, setShowSchedule, widePanelActive, setWidePanelActive, showLogs, setShowLogs,
    pickerState, setPickerState, filterState, setFilterState, outputState, setOutputState,
    firstNodeId, setStartNodeId,
    handleEdgeAdd, handleEdgeDelete, handleEdgeFilter, saveEdgeFilter, handleNodeRun,
    insertModule, updateNodeConfig, deleteNode, handleSave, handleRun,
  }
}
