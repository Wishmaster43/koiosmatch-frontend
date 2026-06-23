/**
 * Workflow graph serialization — pure helpers shared by the canvas editor.
 *
 * Converts between the backend's step list (`steps[]` with `position` + `next`
 * connections) and ReactFlow's `{ nodes, edges }` shape, and back. Kept pure and
 * separate from the editor so the graph round-trip is easy to test and reason about.
 */

// Stable-ish id for a freshly created node.
export const uid = () => 'n_' + Math.random().toString(36).slice(2, 8)

// Build a ReactFlow edge between two node ids (our "addable" edge type).
export const mkEdge = (src, tgt) => ({ id: `e_${src}_${tgt}`, source: src, target: tgt, type: 'addable' })

// Canvas node footprint (used for layout + when inserting new nodes).
export const NODE_W = 90
export const NODE_H = 110

// steps[] → { nodes, edges }. Prefers explicit `next` connections (keeps Router
// branches + edge filters); falls back to a linear chain for legacy workflows.
export function stepsToFlow(steps) {
  const GAP = 220
  const nodes = steps.map((s, i) => ({
    id:       s.id,
    type:     'module',
    position: s.position ?? { x: 80 + i * GAP, y: 180 },
    data:     { type: s.type, config: { ...s.config }, isFirst: i === 0 },
    width:    NODE_W,
    height:   NODE_H,
  }))
  const hasGraph = steps.some(s => Array.isArray(s.next) && s.next.length)
  const edges = hasGraph
    ? steps.flatMap(s => (s.next ?? []).map(n => ({
        ...mkEdge(s.id, n.target),
        data: n.filters ? { filters: n.filters } : undefined,
      })))
    : steps.slice(0, -1).map((s, i) => mkEdge(s.id, steps[i + 1].id))
  return { nodes, edges }
}

// { nodes, edges } → steps[]. Best-effort linear order for the `order` index; the
// real structure lives in each node's `next` (target + edge filters) so Router
// branches and connection filters survive save/reload.
export function flowToSteps(nodes, edges) {
  const adj     = {}
  edges.forEach(e => { if (!(e.source in adj)) adj[e.source] = e.target })
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))
  const starts  = nodes.filter(n => !edges.some(e => e.target === n.id))
  const ordered = []
  let cur = starts[0] ?? nodes[0]
  while (cur && !ordered.includes(cur)) {
    ordered.push(cur)
    cur = adj[cur.id] ? nodeMap[adj[cur.id]] : null
  }
  nodes.forEach(n => { if (!ordered.includes(n)) ordered.push(n) })
  return ordered.map(n => ({
    id:       n.id,
    type:     n.data.type,
    config:   n.data.config,
    position: n.position,
    next:     edges.filter(e => e.source === n.id).map(e => ({
      target:  e.target,
      filters: e.data?.filters ?? null,
    })),
  }))
}
