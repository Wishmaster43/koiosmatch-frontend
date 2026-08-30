/**
 * Unit tests for the edge-filter OR-group shape helpers in serialization.ts —
 * the flat/nested round-trip is exactly what keeps saved workflows backward
 * compatible (WF-ROUTER OR-groups), so it's worth pinning down explicitly.
 */
import { describe, it, expect } from 'vitest'
import {
  parseEdgeFilterGroups, edgeFilterGroupsToFilters, countEdgeFilterConditions,
  stepsToFlow, flowToSteps, mkEdge, uid,
} from './serialization'
import type { FilterCondition, WorkflowStep, FlowNode, FlowEdge } from '@/types/workflow'

const c = (field: string): FilterCondition => ({ field, operator: '=', value: 'x' })

describe('parseEdgeFilterGroups', () => {
  it('starts as one empty group when there is nothing saved yet', () => {
    expect(parseEdgeFilterGroups(null)).toEqual([[]])
    expect(parseEdgeFilterGroups(undefined)).toEqual([[]])
    expect(parseEdgeFilterGroups({})).toEqual([[]])
  })

  it('reads the legacy flat {conditions,logic} shape as one AND-group', () => {
    const legacy = { conditions: [c('a'), c('b')], logic: 'OR' }
    expect(parseEdgeFilterGroups(legacy)).toEqual([[c('a'), c('b')]])
  })

  it('reads a bare flat array (no wrapper) as one AND-group', () => {
    expect(parseEdgeFilterGroups([c('a'), c('b')])).toEqual([[c('a'), c('b')]])
  })

  it('reads a nested array-of-arrays as N OR-groups', () => {
    const nested = [[c('a')], [c('b'), c('c')]]
    expect(parseEdgeFilterGroups(nested)).toEqual(nested)
  })

  it('also accepts a nested shape wrapped in {conditions} defensively', () => {
    const wrapped = { conditions: [[c('a')], [c('b')]] }
    expect(parseEdgeFilterGroups(wrapped)).toEqual([[c('a')], [c('b')]])
  })
})

describe('edgeFilterGroupsToFilters', () => {
  it('persists a single group in the exact legacy shape (backward compatible)', () => {
    expect(edgeFilterGroupsToFilters([[c('a'), c('b')]])).toEqual({ conditions: [c('a'), c('b')], logic: 'AND' })
  })

  // F5 (ROUTER-EDGE-FILTERS-1/D7): zero non-empty groups persists as `null`, not
  // an empty-but-truthy `{conditions:[],logic:'AND'}` — the backend's
  // `$filters !== []` check reads a non-empty array as "this route is
  // filtered" even when it gates nothing, so a cleared filter must serialize
  // to nothing rather than an empty shape.
  it('persists zero/only-empty groups as null (F5, fixes D7)', () => {
    expect(edgeFilterGroupsToFilters([[]])).toBeNull()
    expect(edgeFilterGroupsToFilters([[], []])).toBeNull()
    expect(countEdgeFilterConditions(edgeFilterGroupsToFilters([[]]))).toBe(0)
  })

  it('drops wholly-empty groups before deciding flat vs. nested', () => {
    expect(edgeFilterGroupsToFilters([[], [c('a')]])).toEqual({ conditions: [c('a')], logic: 'AND' })
  })

  it('emits the raw nested [[…],[…]] shape once ≥2 non-empty groups exist', () => {
    const groups = [[c('a')], [c('b'), c('c')]]
    expect(edgeFilterGroupsToFilters(groups)).toEqual(groups)
  })
})

describe('countEdgeFilterConditions', () => {
  it('is 0 for no filter', () => {
    expect(countEdgeFilterConditions(null)).toBe(0)
    expect(countEdgeFilterConditions(undefined)).toBe(0)
  })

  it('counts across the legacy flat shape', () => {
    expect(countEdgeFilterConditions({ conditions: [c('a'), c('b')], logic: 'AND' })).toBe(2)
  })

  it('counts across every OR-group in the nested shape', () => {
    expect(countEdgeFilterConditions([[c('a')], [c('b'), c('c')]])).toBe(3)
  })
})

// ── uid / mkEdge ───────────────────────────────────────────────────────────
describe('uid', () => {
  it('produces distinct, real (backend-validated) UUIDs on each call', () => {
    const a = uid()
    const b = uid()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })
})

describe('mkEdge', () => {
  it('defaults to the out/in handles and derives a deterministic id', () => {
    expect(mkEdge('a', 'b')).toEqual({ id: 'e_a_out_b', source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in', type: 'addable' })
  })

  it('keeps two Router branches to different targets distinct via the source handle in the id', () => {
    const e1 = mkEdge('router1', 'x', 'branch-1')
    const e2 = mkEdge('router1', 'y', 'branch-2')
    expect(e1.id).not.toBe(e2.id)
    expect(e1.sourceHandle).toBe('branch-1')
    expect(e2.sourceHandle).toBe('branch-2')
  })
})

// ── stepsToFlow ──────────────────────────────────────────────────────────────
describe('stepsToFlow', () => {
  it('falls back to a linear chain when no step carries an explicit `next` (legacy workflows)', () => {
    const steps: WorkflowStep[] = [{ id: 'a', type: 'candidates' }, { id: 'b', type: 'whatsapp' }, { id: 'c', type: 'email' }]
    const { nodes, edges } = stepsToFlow(steps)
    expect(nodes.map(n => n.id)).toEqual(['a', 'b', 'c'])
    expect(edges).toEqual([mkEdge('a', 'b'), mkEdge('b', 'c')])
  })

  it('prefers explicit `next` connections over the linear fallback, rendering both Router branches (normalized to the node\'s "out" port)', () => {
    // ModuleNode only exposes a single 'out' handle, so both branches render on it —
    // the original branch id is kept on edge.data.sourceHandleRaw (see the
    // WF-ROUTER-DROP-1 test below), not on the rendered sourceHandle itself.
    const steps: WorkflowStep[] = [
      { id: 'a', type: 'router', next: [{ target: 'b', source_handle: 'branch-1' }, { target: 'c', source_handle: 'branch-2' }] },
      { id: 'b', type: 'email' },
      { id: 'c', type: 'whatsapp' },
    ]
    const { edges } = stepsToFlow(steps)
    expect(edges).toHaveLength(2)
    expect(edges.find(e => e.target === 'b')?.sourceHandle).toBe('out')
    expect(edges.find(e => e.target === 'c')?.sourceHandle).toBe('out')
    expect(edges.find(e => e.target === 'b')?.data).toMatchObject({ sourceHandleRaw: 'branch-1' })
    expect(edges.find(e => e.target === 'c')?.data).toMatchObject({ sourceHandleRaw: 'branch-2' })
  })

  it('carries a connection\'s filters + label onto the edge data when present', () => {
    const steps: WorkflowStep[] = [
      { id: 'a', type: 'router', next: [{ target: 'b', filters: { conditions: [c('x')], logic: 'AND' }, label: 'Yes' }] },
      { id: 'b', type: 'email' },
    ]
    const { edges } = stepsToFlow(steps)
    expect(edges[0].data).toEqual({ filters: { conditions: [c('x')], logic: 'AND' }, label: 'Yes' })
  })

  it('omits edge.data entirely when a connection has neither filters nor a label', () => {
    const steps: WorkflowStep[] = [{ id: 'a', type: 'router', next: [{ target: 'b' }] }, { id: 'b', type: 'email' }]
    expect(stepsToFlow(steps).edges[0].data).toBeUndefined()
  })

  // WF-ROUTER-DROP-1: ModuleNode only renders <Handle id="in">/<Handle id="out">
  // (canvas.tsx:155/281) — ReactFlow silently drops any edge whose handle id doesn't
  // match a node handle. Seeded router templates carry 'route-1'/'route-2'/'route-3' as
  // source_handle (BE NativeWorkflowTemplates.php), so those edges must render on the
  // node's real 'out'/'in' ports while the raw seeded id is preserved for later restore.
  it('normalizes a seeded route-N source_handle to the node\'s real "out" port so the edge renders', () => {
    const steps: WorkflowStep[] = [
      { id: 'a', type: 'router', next: [
        { target: 'b', source_handle: 'route-1', label: 'WhatsApp-toestemming', filters: { conditions: [c('x')], logic: 'AND' } },
        { target: 'c', source_handle: 'route-2' },
        { target: 'd', source_handle: 'route-3' },
      ] },
      { id: 'b', type: 'email' }, { id: 'c', type: 'whatsapp' }, { id: 'd', type: 'sms' },
    ]
    const { edges } = stepsToFlow(steps)
    expect(edges).toHaveLength(3)
    edges.forEach(e => { expect(e.sourceHandle).toBe('out'); expect(e.targetHandle).toBe('in') })
    // The raw seeded handle is preserved on edge data for a future multi-port node,
    // and the filter/label survive so the edge's violet filter indicator still shows.
    const routed = edges.find(e => e.target === 'b')!
    expect(routed.data).toMatchObject({
      sourceHandleRaw: 'route-1', label: 'WhatsApp-toestemming',
      filters: { conditions: [c('x')], logic: 'AND' },
    })
    expect(edges.find(e => e.target === 'c')?.data).toMatchObject({ sourceHandleRaw: 'route-2' })
  })

  it('drops a dangling edge whose target step no longer exists (a stale saved client id)', () => {
    const steps: WorkflowStep[] = [{ id: 'a', type: 'router', next: [{ target: 'ghost' }, { target: 'b' }] }, { id: 'b', type: 'email' }]
    const { edges } = stepsToFlow(steps)
    expect(edges).toHaveLength(1)
    expect(edges[0].target).toBe('b')
  })

  it('falls back to a staggered default position (GAP=220) when a step carries none', () => {
    const { nodes } = stepsToFlow([{ id: 'a', type: 'candidates' }, { id: 'b', type: 'email' }])
    expect(nodes[0].position).toEqual({ x: 80, y: 180 })
    expect(nodes[1].position).toEqual({ x: 300, y: 180 })
  })

  it('marks only the first step as isFirst', () => {
    const { nodes } = stepsToFlow([{ id: 'a', type: 'candidates' }, { id: 'b', type: 'email' }])
    expect(nodes[0].data.isFirst).toBe(true)
    expect(nodes[1].data.isFirst).toBe(false)
  })
})

// ── flowToSteps ──────────────────────────────────────────────────────────────
describe('flowToSteps', () => {
  const node = (id: string, x: number): FlowNode =>
    ({ id, type: 'module', position: { x, y: 0 }, data: { type: 'candidates', config: {} } })

  it('serializes each edge into `next[]` with source_handle/target_handle defaulting to out/in', () => {
    const steps = flowToSteps([node('a', 0), node('b', 220)], [mkEdge('a', 'b')])
    expect(steps.find(s => s.id === 'a')?.next).toEqual([{ target: 'b', filters: null, label: null, source_handle: 'out', target_handle: 'in' }])
  })

  it('restores the raw seeded source_handle from edge.data.sourceHandleRaw on save, instead of the normalized "out"', () => {
    const edges: FlowEdge[] = [{ id: 'e', source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in', type: 'addable', data: { sourceHandleRaw: 'route-1' } }]
    const steps = flowToSteps([node('a', 0), node('b', 220)], edges)
    expect(steps.find(s => s.id === 'a')?.next).toEqual([{ target: 'b', filters: null, label: null, source_handle: 'route-1', target_handle: 'in' }])
  })

  it('never persists a connection to a node id that no longer exists', () => {
    const edges: FlowEdge[] = [{ id: 'e', source: 'a', target: 'ghost', type: 'addable' }]
    expect(flowToSteps([node('a', 0)], edges)[0].next).toEqual([])
  })

  it('orders steps starting from the node with no incoming edge, regardless of array order', () => {
    const steps = flowToSteps([node('b', 220), node('a', 0)], [mkEdge('a', 'b')])
    expect(steps.map(s => s.id)).toEqual(['a', 'b'])
  })

  it('appends a node unreachable from the start (a disconnected second branch)', () => {
    const steps = flowToSteps([node('a', 0), node('orphan', 500)], [])
    expect(steps.map(s => s.id)).toEqual(['a', 'orphan'])
  })
})

// ── round-trip: steps -> flow -> steps ────────────────────────────────────────
// This is the C-27 backend contract: step ids must stay stable across a save/reload
// cycle, or a Router's branches collapse to a straight line on the next open.
// The violet filter indicator on a rendered edge is driven by ONE function:
// countEdgeFilterConditions (canvas.tsx:335-337 sets stroke/width off its > 0).
// Pin it on the REAL seeded shape (NativeWorkflowTemplates: a FLAT filter array),
// so the now-visible router branches provably carry their indicator. A full
// AddableEdge render needs a live ReactFlow viewport (e2e territory) — the
// function-level pin covers the decision the render reads.
describe('edge filter indicator source (countEdgeFilterConditions)', () => {
  it('counts the seeded flat-array consent filter as > 0 (drives the violet edge)', () => {
    expect(countEdgeFilterConditions([{ field: 'whatsapp_consent', operator: '=', value: true }])).toBeGreaterThan(0)
  })
  it('counts empty/absent filters as 0 (plain edge)', () => {
    expect(countEdgeFilterConditions(undefined)).toBe(0)
    expect(countEdgeFilterConditions([])).toBe(0)
  })
})

// Two branches from ONE router to the SAME target must keep distinct edge ids —
// with both normalized to the 'out' handle they would otherwise collapse into
// one React key and silently hide the second condition.
describe('router branches to the same target keep distinct ids', () => {
  it('renders two edges with different ids for route-1/route-2 to one target', () => {
    const { edges } = stepsToFlow([
      { id: 'r', type: 'candidates', config: {}, position: { x: 0, y: 0 }, next: [
        { target: 'w', source_handle: 'route-1', filters: [{ field: 'a', operator: '=', value: 1 }] },
        { target: 'w', source_handle: 'route-2', filters: [{ field: 'b', operator: '=', value: 2 }] },
      ] },
      { id: 'w', type: 'whatsapp', config: {}, position: { x: 200, y: 0 } },
    ])
    const toW = edges.filter(e => e.target === 'w')
    expect(toW).toHaveLength(2)
    expect(new Set(toW.map(e => e.id)).size).toBe(2)
  })
})

describe('round-trip: steps -> flow -> steps', () => {
  it('preserves ids, positions and a Router\'s multiple branches (incl. per-branch filters)', () => {
    const original: WorkflowStep[] = [
      { id: 'a', type: 'router', position: { x: 0, y: 0 }, config: {}, next: [
        { target: 'b', source_handle: 'branch-1', filters: { conditions: [c('x')], logic: 'AND' }, label: 'Yes' },
        { target: 'c', source_handle: 'branch-2' },
      ] },
      { id: 'b', type: 'email', position: { x: 220, y: -80 }, config: { subject: 'Hi' } },
      { id: 'c', type: 'whatsapp', position: { x: 220, y: 80 }, config: {} },
    ]
    const { nodes, edges } = stepsToFlow(original)
    const roundTripped = flowToSteps(nodes, edges)

    expect(roundTripped.map(s => s.id).sort()).toEqual(['a', 'b', 'c'])
    const a = roundTripped.find(s => s.id === 'a')!
    expect(a.next).toHaveLength(2)
    expect(a.next?.find(n => n.target === 'b')).toMatchObject({ source_handle: 'branch-1', filters: { conditions: [c('x')], logic: 'AND' } })
    expect(a.next?.find(n => n.target === 'c')).toMatchObject({ source_handle: 'branch-2' })
    expect(roundTripped.find(s => s.id === 'b')?.position).toEqual({ x: 220, y: -80 })
    expect(roundTripped.find(s => s.id === 'b')?.config).toEqual({ subject: 'Hi' })
  })

  it('a seeded route-N branch survives a full load -> render -> save round-trip byte-identical', () => {
    const original: WorkflowStep[] = [
      { id: 'a', type: 'router', next: [
        { target: 'b', source_handle: 'route-1', target_handle: 'in', label: 'WhatsApp-toestemming', filters: { conditions: [c('x')], logic: 'AND' } },
      ] },
      { id: 'b', type: 'email' },
    ]
    const { nodes, edges } = stepsToFlow(original)
    const roundTripped = flowToSteps(nodes, edges)
    expect(roundTripped.find(s => s.id === 'a')?.next).toEqual(original[0].next)
  })

  // Three-branch Router, one branch carrying a NESTED OR-group filter (the
  // shape a saved EdgeFilterPanel with ≥2 groups persists — serialization.ts's
  // edgeFilterGroupsToFilters), one a flat AND filter, one unconditional — the
  // full contract in one graph, both directions.
  it('preserves THREE Router branches byte-identically, incl. a nested [[…],[…]] OR-group filter on one branch', () => {
    const nested = [[c('a')], [c('b'), c('c')]]
    const original: WorkflowStep[] = [
      { id: 'r', type: 'router', position: { x: 0, y: 0 }, config: {}, next: [
        { target: 'x', source_handle: 'route-1', label: 'Eén', filters: nested },
        { target: 'y', source_handle: 'route-2', label: 'Twee', filters: { conditions: [c('d')], logic: 'AND' } },
        { target: 'z', source_handle: 'route-3' },
      ] },
      { id: 'x', type: 'email', position: { x: 220, y: -160 }, config: {} },
      { id: 'y', type: 'whatsapp', position: { x: 220, y: 0 }, config: {} },
      { id: 'z', type: 'sms', position: { x: 220, y: 160 }, config: {} },
    ]
    const { nodes, edges } = stepsToFlow(original)
    expect(edges).toHaveLength(3)
    // ModuleNode has a single 'out' port, so every rendered edge normalizes there —
    // the three branches stay distinct only via their (raw-handle-carrying) ids.
    edges.forEach(e => expect(e.sourceHandle).toBe('out'))
    expect(new Set(edges.map(e => e.id)).size).toBe(3)

    const roundTripped = flowToSteps(nodes, edges)
    const r = roundTripped.find(s => s.id === 'r')!
    expect(r.next).toHaveLength(3)
    expect(r.next?.find(n => n.target === 'x')).toMatchObject({ source_handle: 'route-1', label: 'Eén', filters: nested })
    expect(r.next?.find(n => n.target === 'y')).toMatchObject({ source_handle: 'route-2', label: 'Twee', filters: { conditions: [c('d')], logic: 'AND' } })
    expect(r.next?.find(n => n.target === 'z')).toMatchObject({ source_handle: 'route-3' })

    // Removing the MIDDLE branch (route-2, target y) leaves the other two branches'
    // ids/handles/filters completely unaffected (no handle renumbering).
    const withoutMiddle = edges.filter(e => e.target !== 'y')
    const afterRemoval = flowToSteps(nodes, withoutMiddle)
    const rAfter = afterRemoval.find(s => s.id === 'r')!
    expect(rAfter.next).toHaveLength(2)
    expect(rAfter.next?.find(n => n.target === 'x')).toMatchObject({ source_handle: 'route-1', filters: nested })
    expect(rAfter.next?.find(n => n.target === 'z')).toMatchObject({ source_handle: 'route-3' })
  })

  it('a second round-trip (flow -> steps -> flow) is idempotent — no drift across repeated save/reload', () => {
    const steps1: WorkflowStep[] = [
      { id: 'a', type: 'candidates', position: { x: 0, y: 0 }, config: {}, next: [{ target: 'b' }] },
      { id: 'b', type: 'email', position: { x: 220, y: 0 }, config: {} },
    ]
    const flow1 = stepsToFlow(steps1)
    const flow2 = stepsToFlow(flowToSteps(flow1.nodes, flow1.edges))
    expect(flow2.nodes.map(n => n.id)).toEqual(flow1.nodes.map(n => n.id))
    expect(flow2.edges.map(e => ({ source: e.source, target: e.target }))).toEqual(flow1.edges.map(e => ({ source: e.source, target: e.target })))
  })

  // F5 (ROUTER-EDGE-FILTERS-1/D7): a cleared filter round-trips to `filters: null`
  // on the persisted step, not the empty-but-truthy `{conditions:[],logic:'AND'}`
  // shape — so the run viewer never marks an unfiltered route as filtered, and
  // the edge badge (countEdgeFilterConditions) stays hidden.
  it('a cleared filter serializes to filters:null and the edge badge stays hidden', () => {
    const original: WorkflowStep[] = [
      { id: 'a', type: 'router', position: { x: 0, y: 0 }, config: {}, next: [
        { target: 'b', source_handle: 'route-1', filters: { conditions: [c('x')], logic: 'AND' } },
      ] },
      { id: 'b', type: 'email' },
    ]
    const { nodes, edges } = stepsToFlow(original)
    // Simulate the panel clearing the one condition, then saving (the same
    // conversion EdgeFilterPanel.handleSave and useWorkflowEditor.saveEdgeFilter use).
    const cleared = edgeFilterGroupsToFilters(parseEdgeFilterGroups({ conditions: [], logic: 'AND' }))
    expect(cleared).toBeNull()
    const clearedEdges = edges.map(e => ({ ...e, data: { ...e.data, filters: cleared } }))
    expect(countEdgeFilterConditions(clearedEdges[0].data?.filters)).toBe(0)

    const roundTripped = flowToSteps(nodes, clearedEdges)
    expect(roundTripped.find(s => s.id === 'a')?.next?.[0]).toMatchObject({ target: 'b', filters: null })
  })
})
