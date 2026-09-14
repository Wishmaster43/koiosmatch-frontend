/**
 * useWorkflowGraph — the ReactFlow nodes/edges state and every graph mutation:
 * connect (incl. auto router-splice), insert/delete a module, router branches,
 * edge filters, node-config edits, node test-runs, and start-node resolution.
 * Extracted from useWorkflowEditor (§3, split at ~400 lines) so the composer
 * stays a thin wiring layer. No trigger/schedule/panel-visibility state here.
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { START_MODULE_TYPES } from '@/modules'
import { addEdge, useNodesState, useEdgesState } from '@xyflow/react'
import type { Connection } from '@xyflow/react'
import { uid, mkEdge, NODE_W, NODE_H, stepsToFlow } from './serialization'
import { defaultConfigFor } from './moduleDefaults'
import { mkEdgePreservingData, buildVarFields } from './workflowEditorUtils'
import { extractApiError } from '@/lib/extractApiError'
import { notifyError } from '@/lib/notify'
import type { Workflow, FlowNode, FlowEdge, FlowNodeData, EdgeFilters, FilterConditionGroup, WorkflowVarGroup } from '@/types/workflow'

// Owns the graph (nodes/edges) for one workflow and every mutation on it.
// `onNodeRunOutput` lets the composer route a node test-run's result to the
// panels hook's outputState without this hook owning panel-visibility state.
export function useWorkflowGraph({ workflow, onNodeRunOutput }: {
  workflow: Workflow
  onNodeRunOutput?: (nodeId: string, output: unknown) => void
}) {
  const { t } = useTranslation('workflows')
  const initFlow = stepsToFlow(
    (workflow.steps || []).map(s => ({ ...s, id: s.id || uid() })),
  )

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initFlow.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([])

  // initFlow is recomputed every render (new object identity), so the deferred-edges
  // effect below must read it from a ref rather than list it as a dependency — that
  // keeps `setEdges` (a stable useEdgesState setter) as the only honest dependency,
  // satisfying exhaustive-deps without a disable.
  const initFlowRef = useRef(initFlow)

  // Defer edges until after nodes are mounted so handles exist in the DOM
  useEffect(() => {
    setEdges(initFlowRef.current.edges)
  }, [setEdges])

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  // null = auto (node without incoming edge, leftmost); set via START badge drag
  const [startNodeId, setStartNodeId] = useState<string | null>(null)

  // User asked to test-run a single node: calls the matching preview endpoint per
  // module type and stashes the result on the node so the config panel can show it.
  const handleNodeRun = useCallback(async (nodeId: string, data: FlowNodeData) => {
    const { default: api } = await import('@/lib/api')
    let output: unknown = null

    try {
      // Generic module test-run — backend POST /workflows/test-module (G-9): previews the
      // module's output; 422 for an unknown or non-testable (really-sends) module type.
      // WORKFLOW-422: we surface the 422 reason ourselves (toast below), so keep it
      // out of the api.ts dev interceptor's own double-toast.
      const res = await api.post('/workflows/test-module', { module_type: data.type, config: data.config }, { quietStatuses: [422] })
      // AVOND4-12 (CMBE c253fac6): a wa_web config state (no device chosen, device not
      // linked or disconnected) answers 200 with top-level `no_recipients`/`reason`/
      // `message` beside a zero-count output — keep the sentence on the node, or the
      // panel would show bare zeros for a step that honestly did nothing.
      const body = res.data as { output?: unknown; no_recipients?: boolean; reason?: string; message?: string } | undefined
      const preview = body?.output ?? body
      const previewObj = preview && typeof preview === 'object' && !Array.isArray(preview) ? preview as Record<string, unknown> : {}
      output = body?.no_recipients === true
        ? { ...previewObj, no_recipients: true, reason: body.reason, message: body.message }
        : preview
    } catch (err) {
      // WORKFLOW-422: same extraction for the panel line and the toast, so the
      // two never disagree (e.g. "no active WhatsApp number").
      const reason = extractApiError(err, t('config.testFailed'))
      output = { error: reason }
      notifyError(reason)
    }

    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, output } } : n))
    onNodeRunOutput?.(nodeId, output)
  }, [setNodes, onNodeRunOutput, t])

  // User removed a connector on the canvas — drop that one edge, nothing else.
  const handleEdgeDelete = useCallback((edgeId: string) => {
    setEdges(eds => eds.filter(e => e.id !== edgeId))
  }, [setEdges])

  // Filter panel submitted — write the condition + optional label onto that one
  // edge. F5: `filters` may be `null` (a fully-cleared filter), which must be
  // written as-is so the edge badge (countEdgeFilterConditions(null) === 0)
  // stays hidden and the persisted step carries no filter at all.
  const saveEdgeFilter = useCallback((edgeId: string, filters: EdgeFilters | FilterConditionGroup[] | null, label: string) => {
    setEdges(eds => eds.map(e => e.id === edgeId ? { ...e, data: { ...e.data, filters, label: label || undefined } } : e))
  }, [setEdges])

  // User dragged a new connection between two handles: a plain add unless the
  // target already has an incoming edge, in which case a router node is spliced
  // in so both sources can feed the same target.
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
        // CONSENT-BEHOUD-1 / ROUTER-EDGE-FILTERS-1 D3 (centralised helper): the
        // existing incoming edge's data (filters/label/sourceHandleRaw) must
        // survive the router splice.
        ...existingIncoming.map(e => mkEdgePreservingData(e.source, routerId, e.data)),
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
        // DEFAULT-PERSIST-1: same seeding as insertModule (router's own schema is
        // empty today, so this is a no-op — kept for consistency, not behaviour).
        const routerNode: FlowNode = {
          id: routerId, type: 'module',
          position: { x, y },
          data: { type: 'router', config: defaultConfigFor('router') },
          width: NODE_W, height: NODE_H,
        }
        return [...nds, routerNode]
      })

      return newEdges
    })
  }, [setEdges, setNodes])

  // Picker chose a module type: append it as a new tail node, or splice it into
  // an existing edge (keeping that edge's filter/consent data on the upstream half).
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
      // DEFAULT-PERSIST-1: a freshly created node starts with its schema defaults
      // already IN the config, not just shown by the panel (see moduleDefaults.ts).
      return [...nds, { id: newId, type: 'module', position: { x, y }, width: NODE_W, height: NODE_H, data: { type, config: defaultConfigFor(type) } }]
    })

    if (edgeId) {
      // Batch node + edge update together using flushSync equivalent — just do them sequentially
      setEdges(eds => {
        const edge = eds.find(e => e.id === edgeId)
        if (!edge) return eds
        // CONSENT-BEHOUD-1 (centralised helper): the split's BRANCH side keeps
        // the original edge's data (filters like whatsapp_consent, label, raw
        // route handles) — the moment the branch became visible.
        return [
          ...eds.filter(e => e.id !== edgeId),
          mkEdgePreservingData(edge.source, newId, edge.data),
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
          // DEFAULT-PERSIST-1: same seeding as the append path above.
          { id: newId, type: 'module', position: { x: midX, y: midY - 120 }, width: NODE_W, height: NODE_H, data: { type, config: defaultConfigFor(type) } },
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

  // F2 (ROUTER-EDGE-FILTERS-1/D4): add one new branch off an existing Router node.
  // The node is created UNCONNECTED to lastNode (never routed through onConnect,
  // which would trip the router-splice branch above) and gets exactly one new
  // edge routerId -> newId. The new node is added WITH its incoming edge in the
  // same commit, so it can never be picked up as firstNodeId (that only happens
  // to a node with no incoming edge at all). Source handles stay 'out': distinct
  // source_handle values per branch are pointless until the backend teaches
  // WorkflowGraph the handle (D2) — distinct TARGETS are what make branches work
  // today.
  const addRouterBranch = useCallback((routerId: string, type: string) => {
    const newId = uid()
    setNodes(nds => {
      const routerNode = nds.find(n => n.id === routerId)
      const existingBranches = edges.filter(e => e.source === routerId).length
      const x = (routerNode?.position.x ?? 300) + 260
      const y = (routerNode?.position.y ?? 180) + existingBranches * 140
      return [...nds, { id: newId, type: 'module', position: { x, y }, width: NODE_W, height: NODE_H, data: { type, config: defaultConfigFor(type) } }]
    })
    setEdges(eds => {
      // ROUTER-FE-2 (BE 4bb21265 honours source_handle): every added branch gets its
      // own route-N handle, unique against the router's existing raw handles.
      const used = new Set(eds.filter(e => e.source === routerId).map(e => (e.data as { sourceHandleRaw?: string } | undefined)?.sourceHandleRaw ?? 'out'))
      let n = 1
      while (used.has(`route-${n}`)) n += 1
      return [...eds, { ...mkEdge(routerId, newId), data: { sourceHandleRaw: `route-${n}` } }]
    })
    setSelectedNodeId(newId)
  }, [setNodes, setEdges, edges])

  // Config panel edited one field of one node — merge just that key into its config.
  const updateNodeConfig = useCallback((nodeId: string, key: string, val: unknown) => {
    setNodes(nds => nds.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, config: { ...n.data.config, [key]: val } } } : n
    ))
  }, [setNodes])

  // Remove a node and re-wire around it: if it sat between an incoming and an
  // outgoing edge, splice them into one direct edge (keeping the incoming edge's
  // filter data) instead of leaving the graph disconnected.
  const deleteNode = useCallback((nodeId: string) => {
    setEdges(eds => {
      const inEdge  = eds.find(e => e.target === nodeId)
      const outEdge = eds.find(e => e.source === nodeId)
      const without = eds.filter(e => e.source !== nodeId && e.target !== nodeId)
      if (inEdge && outEdge) {
        // CONSENT-BEHOUD-1 (centralised helper): re-linking keeps the INCOMING
        // edge's data (filters/label/raw handles) so deleting a mid-branch node
        // never silently drops the branch condition.
        return [...without, mkEdgePreservingData(inEdge.source, outEdge.target, inEdge.data)]
      }
      return without
    })
    setNodes(nds => nds.filter(n => n.id !== nodeId))
    setSelectedNodeId(id => id === nodeId ? null : id)
  }, [setEdges, setNodes])

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

  // VERTREKMODULE-1 (Danny 30/31-08): a workflow STARTS at Koios master data —
  // an entity node or the inbound webhook. Any other first step renders the
  // header warning (editor.missingStartModule); the seeder fix is BE-side.
  const firstNode = nodes.find(n => n.id === firstNodeId)
  const startInvalid = firstNode != null && !START_MODULE_TYPES.has(firstNode.data.type ?? '')

  return {
    nodes, setNodes, edges, setEdges, onNodesChange, onEdgesChange, onConnect,
    // The pre-deferral flow (§ dirty-check baseline): useWorkflowTrigger uses these,
    // not the live `nodes`/`edges`, to seed its saved-snapshot — `edges` starts empty
    // and only gets `initFlow.edges` one tick later via the effect above, so a
    // first-render snapshot built from the live state would freeze a zero-edge
    // baseline and read every workflow with a connection as dirty forever.
    initialNodes: initFlow.nodes, initialEdges: initFlow.edges,
    selectedNode, setSelectedNodeId, startNodeId, setStartNodeId, firstNodeId, startInvalid,
    handleEdgeDelete, saveEdgeFilter, handleNodeRun,
    insertModule, addRouterBranch, updateNodeConfig, deleteNode, getUpstreamVariables,
  }
}
