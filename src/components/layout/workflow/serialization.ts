/**
 * Workflow graph serialization — pure helpers shared by the canvas editor.
 *
 * Converts between the backend's step list (`steps[]` with `position` + `next`
 * connections) and ReactFlow's `{ nodes, edges }` shape, and back. Kept pure and
 * separate from the editor so the graph round-trip is easy to test and reason about.
 */

import type { WorkflowStep, FlowNode, FlowEdge } from '@/types/workflow'

// Stable id for a freshly created node. A REAL uuid: the backend honours the
// editor's step id on create but validates it as uuid (steps.*.id) — a non-uuid
// id made every save with a new node fail ("must be a valid UUID").
export const uid = () => crypto.randomUUID()

// Build a ReactFlow edge between two node ids (our "addable" edge type). Handles
// default to 'out'/'in'; a router branch passes its own port id as sourceHandle so
// each outgoing branch stays distinct (matches the BE source_handle contract).
export const mkEdge = (
  src?: string | number | null, tgt?: string | number | null,
  sourceHandle: string = 'out', targetHandle: string = 'in',
): FlowEdge =>
  ({ id: `e_${src}_${sourceHandle}_${tgt}`, source: String(src), target: String(tgt), sourceHandle, targetHandle, type: 'addable' })

// Canvas node footprint (used for layout + when inserting new nodes).
export const NODE_W = 90
export const NODE_H = 110

// steps[] → { nodes, edges }. Prefers explicit `next` connections (keeps Router
// branches + edge filters); falls back to a linear chain for legacy workflows.
export function stepsToFlow(steps: WorkflowStep[]): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const GAP = 220
  const nodes: FlowNode[] = steps.map((s, i) => ({
    id:       String(s.id),
    type:     'module',
    position: (s.position as { x: number; y: number } | undefined) ?? { x: 80 + i * GAP, y: 180 },
    data:     { type: s.type, config: { ...s.config }, isFirst: i === 0 },
    width:    NODE_W,
    height:   NODE_H,
  }))
  const hasGraph = steps.some(s => Array.isArray(s.next) && s.next.length)
  const edges: FlowEdge[] = hasGraph
    ? steps.flatMap(s => (s.next ?? []).map(n => ({
        ...mkEdge(s.id, n.target, n.source_handle ?? 'out', n.target_handle ?? 'in'),
        data: (n.filters || n.label) ? { filters: n.filters, label: n.label ?? undefined } : undefined,
      })))
    : steps.slice(0, -1).map((s, i) => mkEdge(s.id, steps[i + 1].id))
  // Drop dangling edges (an endpoint that isn't a node — e.g. a stale client id
  // saved in `next`): ReactFlow spams error#008 for every unresolvable edge.
  const nodeIds = new Set(nodes.map(n => n.id))
  return { nodes, edges: edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target)) }
}

// { nodes, edges } → steps[]. Best-effort linear order for the `order` index; the
// real structure lives in each node's `next` (target + edge filters) so Router
// branches and connection filters survive save/reload.
export function flowToSteps(nodes: FlowNode[], edges: FlowEdge[]): WorkflowStep[] {
  const adj: Record<string, string> = {}
  edges.forEach(e => { if (!(e.source in adj)) adj[e.source] = e.target })
  const nodeMap: Record<string, FlowNode> = Object.fromEntries(nodes.map(n => [n.id, n]))
  const starts  = nodes.filter(n => !edges.some(e => e.target === n.id))
  const ordered: FlowNode[] = []
  let cur: FlowNode | null | undefined = starts[0] ?? nodes[0]
  while (cur && !ordered.includes(cur)) {
    ordered.push(cur)
    cur = adj[cur.id] ? nodeMap[adj[cur.id]] : null
  }
  nodes.forEach(n => { if (!ordered.includes(n)) ordered.push(n) })
  // Never persist a connection to a node that doesn't exist (keeps saved graphs clean).
  const validIds = new Set(nodes.map(n => n.id))
  return ordered.map(n => ({
    id:       n.id,
    type:     n.data.type,
    config:   n.data.config,
    position: n.position,
    next:     edges.filter(e => e.source === n.id && validIds.has(e.target)).map(e => ({
      target:        e.target,
      filters:       e.data?.filters ?? null,
      label:         e.data?.label ?? null,
      source_handle: (e.sourceHandle as string | undefined) ?? 'out',
      target_handle: (e.targetHandle as string | undefined) ?? 'in',
    })),
  }))
}
