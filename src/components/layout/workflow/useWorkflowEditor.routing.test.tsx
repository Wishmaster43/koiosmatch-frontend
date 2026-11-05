/** useWorkflowEditor · edge filters, router branches, node config, start node and upstream variables (split from useWorkflowEditor.test.tsx; same QueryClient harness). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { Connection } from '@xyflow/react'
import { useWorkflowEditor } from './useWorkflowEditor'
import type { Workflow, WorkflowStep } from '@/types/workflow'

// RUN-CONTROL-1's mount effect adopts a live run via GET /workflows/{id}/runs
// through the default client — stub it, but keep the real unwrap/unwrapList
// (importActual) so that call still resolves cleanly.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn().mockResolvedValue({ data: { data: [] } }), post: vi.fn() } }
})

// Fresh QueryClient per render — useWorkflowRunControl's useWorkflowRun always
// calls useQuery (disabled while activeRunId is null, so no network happens).
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

// Minimal normalized workflow fixture — only the fields the editor reads.
const wf = (steps: WorkflowStep[], overrides: Partial<Workflow> = {}): Workflow =>
  ({ id: 'w1', name: 'My workflow', trigger: 'Manual', status: 'draft', steps, ...overrides })

function setup(steps: WorkflowStep[], overrides: Partial<Workflow> = {}) {
  const onSave = vi.fn()
  const r = renderHook(() => useWorkflowEditor({ workflow: wf(steps, overrides), onSave }), { wrapper })
  return { ...r, onSave }
}

// A plain react-flow Connection (onConnect's param shape).
const conn = (source: string, target: string): Connection => ({ source, target, sourceHandle: null, targetHandle: null })

beforeEach(() => vi.clearAllMocks())

describe('useWorkflowEditor · edge filters', () => {
  const steps = (): WorkflowStep[] => [
    { id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 180 }, next: [{ target: 'n2' }] },
    { id: 'n2', type: 'email', config: {}, position: { x: 220, y: 180 } },
  ]

  it('saveEdgeFilter stores the filter+label on the exact edge, dropping an empty label to undefined', async () => {
    const { result } = setup(steps())
    await waitFor(() => expect(result.current.edges).toHaveLength(1))
    const edgeId = result.current.edges[0].id
    act(() => result.current.saveEdgeFilter(edgeId, { conditions: [{ field: 'x', operator: '=', value: '1' }], logic: 'AND' }, ''))
    expect(result.current.edges[0].data).toEqual({ filters: { conditions: [{ field: 'x', operator: '=', value: '1' }], logic: 'AND' }, label: undefined })
  })

  it('handleEdgeDelete removes exactly the targeted edge', async () => {
    const { result } = setup(steps())
    await waitFor(() => expect(result.current.edges).toHaveLength(1))
    act(() => result.current.handleEdgeDelete(result.current.edges[0].id))
    expect(result.current.edges).toHaveLength(0)
  })

  it('handleEdgeAdd / handleEdgeFilter open the picker/filter panel scoped to that edge', async () => {
    const { result } = setup(steps())
    await waitFor(() => expect(result.current.edges).toHaveLength(1))
    const edgeId = result.current.edges[0].id
    act(() => result.current.handleEdgeAdd(edgeId))
    expect(result.current.pickerState).toEqual({ edgeId })
    act(() => result.current.handleEdgeFilter(edgeId))
    expect(result.current.filterState).toEqual({ edgeId })
  })
})

describe('useWorkflowEditor · Router with existing branches', () => {
  // A router already carrying two seeded branches (route-1/route-2, each with
  // its own filter) — the shape a template/reload leaves in place.
  const routerSteps = (): WorkflowStep[] => [
    { id: 'r', type: 'router', config: {}, position: { x: 0, y: 180 }, next: [
      { target: 'b1', source_handle: 'route-1', label: 'Eén', filters: { conditions: [{ field: 'a', operator: '=', value: '1' }], logic: 'AND' } },
      { target: 'b2', source_handle: 'route-2', label: 'Twee', filters: { conditions: [{ field: 'b', operator: '=', value: '2' }], logic: 'AND' } },
    ] },
    { id: 'b1', type: 'email', config: {}, position: { x: 220, y: 60 } },
    { id: 'b2', type: 'whatsapp', config: {}, position: { x: 220, y: 300 } },
    { id: 'b3', type: 'sms', config: {}, position: { x: 220, y: 540 } }, // an unconnected third target, not yet a branch
  ]

  it('adding a plain connection to a fresh target grows a THIRD branch, leaving the two existing ones untouched', async () => {
    const { result } = setup(routerSteps())
    await waitFor(() => expect(result.current.edges).toHaveLength(2))
    const before = result.current.edges.map(e => ({ id: e.id, data: e.data }))

    act(() => result.current.onConnect(conn('r', 'b3')))

    expect(result.current.edges).toHaveLength(3)
    // The two existing branches (id + filter/label data) are byte-identical to before.
    before.forEach(b => expect(result.current.edges.find(e => e.id === b.id)?.data).toEqual(b.data))
    const newBranch = result.current.edges.find(e => e.target === 'b3')!
    expect(newBranch.source).toBe('r')
    expect(newBranch.data).toBeUndefined() // a fresh branch carries no filter/label yet
  })

  it('deleting the middle branch leaves the first branch untouched and does not disturb the (still separate) third', async () => {
    const { result } = setup(routerSteps())
    await waitFor(() => expect(result.current.edges).toHaveLength(2))
    act(() => result.current.onConnect(conn('r', 'b3'))) // grow to 3 branches first
    expect(result.current.edges).toHaveLength(3)
    const branch1Before = result.current.edges.find(e => e.target === 'b1')!.data
    const branch3Before = result.current.edges.find(e => e.target === 'b3')!.data

    const middleEdgeId = result.current.edges.find(e => e.target === 'b2')!.id
    act(() => result.current.handleEdgeDelete(middleEdgeId))

    expect(result.current.edges).toHaveLength(2)
    expect(result.current.edges.some(e => e.target === 'b2')).toBe(false)
    expect(result.current.edges.find(e => e.target === 'b1')?.data).toEqual(branch1Before)
    expect(result.current.edges.find(e => e.target === 'b3')?.data).toEqual(branch3Before)
  })

  it('each branch opens the SAME filter editor, scoped to its own edge id', async () => {
    const { result } = setup(routerSteps())
    await waitFor(() => expect(result.current.edges).toHaveLength(2))
    const edge1 = result.current.edges.find(e => e.target === 'b1')!.id
    const edge2 = result.current.edges.find(e => e.target === 'b2')!.id

    act(() => result.current.handleEdgeFilter(edge1))
    expect(result.current.filterState).toEqual({ edgeId: edge1 })
    act(() => result.current.handleEdgeFilter(edge2))
    expect(result.current.filterState).toEqual({ edgeId: edge2 })

    // Saving through the one shared handler only ever touches the edge it was scoped to.
    act(() => result.current.saveEdgeFilter(edge2, { conditions: [{ field: 'z', operator: '=', value: '9' }], logic: 'AND' }, 'Aangepast'))
    // saveEdgeFilter merges onto the edge's existing data, so its preserved
    // sourceHandleRaw (route-2, restoring the seeded port on the next save) survives.
    expect(result.current.edges.find(e => e.id === edge2)?.data).toEqual({ filters: { conditions: [{ field: 'z', operator: '=', value: '9' }], logic: 'AND' }, label: 'Aangepast', sourceHandleRaw: 'route-2' })
    expect(result.current.edges.find(e => e.id === edge1)?.data).toEqual({ filters: { conditions: [{ field: 'a', operator: '=', value: '1' }], logic: 'AND' }, label: 'Eén', sourceHandleRaw: 'route-1' })
  })
})

describe('useWorkflowEditor · updateNodeConfig', () => {
  it('merges a single key into the node config, leaving siblings untouched', async () => {
    const { result } = setup([{ id: 'n1', type: 'candidates', config: { limit: 10 }, position: { x: 0, y: 0 } }])
    await waitFor(() => expect(result.current.nodesWithFirst).toHaveLength(1))
    act(() => result.current.updateNodeConfig('n1', 'limit', 25))
    expect(result.current.nodesWithFirst[0].data.config).toEqual({ limit: 25 })
    act(() => result.current.updateNodeConfig('n1', 'naam', 'Mijn stap'))
    expect(result.current.nodesWithFirst[0].data.config).toEqual({ limit: 25, naam: 'Mijn stap' })
  })
})

describe('useWorkflowEditor · start-node override', () => {
  it('defaults to the leftmost node without an incoming edge, and a manual override wins', async () => {
    const { result } = setup([
      { id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 0 } },
      { id: 'n2', type: 'email', config: {}, position: { x: 220, y: 0 } },
    ])
    await waitFor(() => expect(result.current.nodesWithFirst).toHaveLength(2))
    expect(result.current.firstNodeId).toBe('n1')
    act(() => result.current.setStartNodeId('n2'))
    expect(result.current.firstNodeId).toBe('n2')
    expect(result.current.nodesWithFirst.find(n => n.id === 'n2')?.data.isFirst).toBe(true)
    expect(result.current.nodesWithFirst.find(n => n.id === 'n1')?.data.isFirst).toBe(false)
  })

  it('falls back to auto when the override points at a node that no longer exists', async () => {
    const { result } = setup([{ id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 0 } }])
    await waitFor(() => expect(result.current.nodesWithFirst).toHaveLength(1))
    act(() => result.current.setStartNodeId('ghost'))
    expect(result.current.firstNodeId).toBe('n1')
  })
})

describe('useWorkflowEditor · getUpstreamVariables', () => {
  it('walks edges backward and orders ancestor groups left-to-right (not BFS-visit order)', async () => {
    const { result } = setup([
      { id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 0 }, next: [{ target: 'n2' }] },
      { id: 'n2', type: 'email', config: {}, position: { x: 220, y: 0 }, next: [{ target: 'n3' }] },
      { id: 'n3', type: 'whatsapp', config: {}, position: { x: 440, y: 0 } },
    ])
    await waitFor(() => expect(result.current.edges).toHaveLength(2))
    const groups = result.current.getUpstreamVariables('n3')
    // BFS from n3 visits n2 first, then n1 — but the returned groups are sorted by
    // x-position (left-to-right), so n1 (the true upstream start) comes first.
    expect(groups.map(g => g.nodeId)).toEqual(['n1', 'n2'])
    expect(groups[0].hasRun).toBe(false)
    expect(groups[0].fields).toEqual([{ token: '{{n1}}', label: '' }])
  })

  it('returns nothing for a falsy nodeId (no crash on the very first node)', async () => {
    const { result } = setup([{ id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 0 } }])
    await waitFor(() => expect(result.current.nodesWithFirst).toHaveLength(1))
    expect(result.current.getUpstreamVariables(null)).toEqual([])
  })
})
