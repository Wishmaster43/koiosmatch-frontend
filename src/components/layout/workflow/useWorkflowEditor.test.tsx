/**
 * useWorkflowEditor — behaviour tests for the graph-mutation seams: connecting
 * nodes (incl. the router auto-insert when a target already has an incoming
 * edge), inserting/deleting a node, edge filters, the manual start-node
 * override, upstream-variable resolution, the dirty-check, and the
 * denormalized save payload (trigger_config per trigger type). Mirrors the
 * useWorkflowRunControl.test.tsx harness (QueryClientProvider + mocked
 * '@/lib/api' via importActual, so the real unwrap/unwrapList still run).
 */
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

describe('useWorkflowEditor · initial load', () => {
  it('builds nodes+edges from the workflow steps via stepsToFlow (edges deferred one tick)', async () => {
    const { result } = setup([
      { id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 180 }, next: [{ target: 'n2' }] },
      { id: 'n2', type: 'email', config: {}, position: { x: 220, y: 180 } },
    ])
    await waitFor(() => expect(result.current.edges).toHaveLength(1))
    expect(result.current.nodesWithFirst.map(n => n.id)).toEqual(['n1', 'n2'])
    expect(result.current.edges[0]).toMatchObject({ source: 'n1', target: 'n2' })
  })

  // DEFAULT-PERSIST-1: loading NEVER retro-migrates a saved node — a config saved
  // before `skip_weekends` existed (or before it had a default) stays exactly as
  // persisted, defaults are seeded only at node CREATION (insertModule above).
  it('leaves an EXISTING node\'s config untouched — no retro-seeded defaults on load', async () => {
    const { result } = setup([
      { id: 'n1', type: 'wait', config: { days: 2 }, position: { x: 0, y: 180 } },
    ])
    await waitFor(() => expect(result.current.nodesWithFirst).toHaveLength(1))
    expect(result.current.nodesWithFirst[0].data.config).toEqual({ days: 2 })
  })
})

describe('useWorkflowEditor · onConnect', () => {
  const steps = (): WorkflowStep[] => [
    { id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 180 } },
    { id: 'n2', type: 'email', config: {}, position: { x: 220, y: 180 }, next: [{ target: 'n3' }] },
    { id: 'n3', type: 'whatsapp', config: {}, position: { x: 440, y: 180 } },
  ]

  it('adds a plain edge when the target has no incoming edge yet', async () => {
    const { result } = setup(steps())
    await waitFor(() => expect(result.current.edges).toHaveLength(1))
    act(() => result.current.onConnect(conn('n1', 'n2')))
    expect(result.current.edges).toHaveLength(2)
    expect(result.current.edges.some(e => e.source === 'n1' && e.target === 'n2' && e.type === 'addable')).toBe(true)
  })

  it('inserts a Router node when the target already has an incoming edge, rewiring both sources through it', async () => {
    const { result } = setup(steps())
    await waitFor(() => expect(result.current.edges).toHaveLength(1))
    act(() => result.current.onConnect(conn('n1', 'n3')))

    // The direct n2 -> n3 edge is gone; n1 AND n2 now point at a NEW router node,
    // which alone points at n3 — the router-auto-insert seam (onConnect's 2nd branch).
    expect(result.current.edges).toHaveLength(3)
    expect(result.current.edges.some(e => e.source === 'n2' && e.target === 'n3')).toBe(false)
    const toN3 = result.current.edges.filter(e => e.target === 'n3')
    expect(toN3).toHaveLength(1)
    const routerId = toN3[0].source
    expect(result.current.edges.filter(e => e.target === routerId).map(e => e.source).sort()).toEqual(['n1', 'n2'])
    expect(result.current.nodesWithFirst.find(n => n.id === routerId)?.data.type).toBe('router')
  })

  // F1 (ROUTER-EDGE-FILTERS-1/D3): the router auto-insert must carry the
  // existing incoming edge's data (filters/label/raw handle) onto the new
  // n2->router edge — a bare mkEdge here silently dropped it (measured to fail
  // on pre-F1 code).
  it('preserves the existing incoming edge\'s filters/label/sourceHandleRaw on the router splice', async () => {
    const branchSteps: WorkflowStep[] = [
      { id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 180 } },
      { id: 'n2', type: 'email', config: {}, position: { x: 220, y: 180 }, next: [
        { target: 'n3', source_handle: 'route-1', label: 'Breda-route',
          filters: [{ field: 'city', operator: '=', value: 'Breda' }] },
      ] },
      { id: 'n3', type: 'whatsapp', config: {}, position: { x: 440, y: 180 } },
    ]
    const { result } = setup(branchSteps)
    await waitFor(() => expect(result.current.edges).toHaveLength(1))
    act(() => result.current.onConnect(conn('n1', 'n3')))

    const routerEdge = result.current.edges.find(e => e.source === 'n2')!
    expect(routerEdge.data?.filters).toEqual([{ field: 'city', operator: '=', value: 'Breda' }])
    expect(routerEdge.data?.label).toBe('Breda-route')
    expect(routerEdge.data?.sourceHandleRaw).toBe('route-1')
  })
})

describe('useWorkflowEditor · addRouterBranch (F2, fixes D4)', () => {
  const routerSteps = (): WorkflowStep[] => [
    { id: 'r', type: 'router', config: {}, position: { x: 0, y: 180 }, next: [
      { target: 'a', source_handle: 'route-1', label: 'Eén',
        filters: [{ field: 'city', operator: '=', value: 'Breda' }] },
    ] },
    { id: 'a', type: 'email', config: {}, position: { x: 220, y: 180 } },
  ]

  it('adds branches unconnected to lastNode, never as firstNodeId, leaving the existing branch untouched', async () => {
    const { result } = setup(routerSteps())
    await waitFor(() => expect(result.current.edges).toHaveLength(1))

    act(() => result.current.addRouterBranch('r', 'whatsapp'))
    act(() => result.current.addRouterBranch('r', 'sms'))

    const fromRouter = result.current.edges.filter(e => e.source === 'r')
    expect(fromRouter).toHaveLength(3)
    // Distinct edge ids and distinct targets (D2 blocked: targets carry the branches today).
    expect(new Set(fromRouter.map(e => e.id)).size).toBe(3)
    expect(new Set(fromRouter.map(e => e.target)).size).toBe(3)

    // ROUTER-FE-2 (BE 4bb21265): added branches carry their own route-N handle,
    // unique against the seeded route-1.
    const raws = fromRouter.map(e => (e.data as { sourceHandleRaw?: string } | undefined)?.sourceHandleRaw)
    expect(raws).toContain('route-1')
    expect(raws).toContain('route-2')
    expect(raws).toContain('route-3')

    // The pre-existing branch's data is untouched.
    const originalBranch = fromRouter.find(e => e.target === 'a')!
    expect(originalBranch.data?.filters).toEqual([{ field: 'city', operator: '=', value: 'Breda' }])
    expect(originalBranch.data?.label).toBe('Eén')

    // Guard: neither new node ever becomes firstNodeId — each gets its incoming
    // edge in the same commit as its creation.
    const newNodeIds = fromRouter.map(e => e.target).filter(t => t !== 'a')
    newNodeIds.forEach(id => {
      expect(result.current.nodesWithFirst.find(n => n.id === id)?.data.isFirst).toBe(false)
    })

    // flowToSteps emits three next entries with distinct targets.
    const { flowToSteps } = await import('./serialization')
    const rStep = flowToSteps(result.current.nodesWithFirst, result.current.edges).find(s => s.id === 'r')!
    expect(rStep.next).toHaveLength(3)
    expect(new Set(rStep.next!.map(n => n.target)).size).toBe(3)
  })
})

describe('useWorkflowEditor · insertModule', () => {
  const steps = (): WorkflowStep[] => [
    { id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 180 } },
    { id: 'n2', type: 'email', config: {}, position: { x: 220, y: 180 }, next: [{ target: 'n3' }] },
    { id: 'n3', type: 'whatsapp', config: {}, position: { x: 440, y: 180 } },
  ]

  it('appends a new node after the current last node when no edge is targeted', async () => {
    const { result } = setup(steps())
    await waitFor(() => expect(result.current.edges).toHaveLength(1))
    act(() => result.current.insertModule('whatsapp', null))

    expect(result.current.nodesWithFirst).toHaveLength(4)
    const newNode = result.current.selectedNode!
    expect(newNode.data.type).toBe('whatsapp')
    expect(newNode.position).toEqual({ x: 660, y: 180 }) // n3.x (last node) + 220
    expect(result.current.edges.some(e => e.source === 'n3' && e.target === newNode.id)).toBe(true)
  })

  it('splits the targeted edge in two, shifting nodes right of the source over to make room', async () => {
    const { result } = setup(steps())
    await waitFor(() => expect(result.current.edges).toHaveLength(1))
    const edgeId = result.current.edges[0].id // n2 -> n3
    act(() => result.current.insertModule('whatsapp', edgeId))

    expect(result.current.edges.some(e => e.id === edgeId)).toBe(false) // original edge gone
    const newNode = result.current.selectedNode!
    expect(result.current.edges.some(e => e.source === 'n2' && e.target === newNode.id)).toBe(true)
    expect(result.current.edges.some(e => e.source === newNode.id && e.target === 'n3')).toBe(true)
    expect(newNode.position).toEqual({ x: 330, y: 60 }) // midpoint of n2/n3, raised
    expect(result.current.nodesWithFirst.find(n => n.id === 'n3')?.position.x).toBe(660) // shifted +220
  })

  // CONSENT-BEHOUD-1: splitting a BRANCH edge keeps the branch's own data —
  // the seeded consent filter, label and raw route handle must survive an
  // insert-on-edge, or one click destroys the condition and the next save
  // persists an unconditional send (Opus wave-B1 finding).
  it('keeps the edge data (filters/label/raw handle) on the branch side of a split', async () => {
    const branchSteps: WorkflowStep[] = [
      { id: 'r1', type: 'candidates', config: {}, position: { x: 0, y: 180 }, next: [
        { target: 'w1', source_handle: 'route-1', label: 'WhatsApp-toestemming',
          filters: [{ field: 'whatsapp_consent', operator: '=', value: true }] },
      ] },
      { id: 'w1', type: 'whatsapp', config: {}, position: { x: 440, y: 180 } },
    ]
    const { result } = setup(branchSteps)
    await waitFor(() => expect(result.current.edges).toHaveLength(1))
    const edge = result.current.edges[0]
    expect(edge.data?.filters).toEqual([{ field: 'whatsapp_consent', operator: '=', value: true }])
    act(() => result.current.insertModule('email', edge.id))
    const branchSide = result.current.edges.find(e => e.source === 'r1')!
    expect(branchSide.data?.filters).toEqual([{ field: 'whatsapp_consent', operator: '=', value: true }])
    expect(branchSide.data?.label).toBe('WhatsApp-toestemming')
    expect(branchSide.data?.sourceHandleRaw).toBe('route-1')
  })

  it('keeps the incoming edge data when deleting a mid-branch node re-links around it', async () => {
    const branchSteps: WorkflowStep[] = [
      { id: 'r1', type: 'candidates', config: {}, position: { x: 0, y: 180 }, next: [
        { target: 'm1', source_handle: 'route-2', label: 'E-mail-tak',
          filters: [{ field: 'email_consent', operator: '=', value: true }] },
      ] },
      { id: 'm1', type: 'email', config: {}, position: { x: 220, y: 180 }, next: [{ target: 'w1' }] },
      { id: 'w1', type: 'whatsapp', config: {}, position: { x: 440, y: 180 } },
    ]
    const { result } = setup(branchSteps)
    await waitFor(() => expect(result.current.edges).toHaveLength(2))
    act(() => result.current.deleteNode('m1'))
    const relinked = result.current.edges.find(e => e.source === 'r1' && e.target === 'w1')!
    expect(relinked.data?.filters).toEqual([{ field: 'email_consent', operator: '=', value: true }])
    expect(relinked.data?.sourceHandleRaw).toBe('route-2')
  })

  // DEFAULT-PERSIST-1: a dropped node's config carries its schema defaults from the
  // moment it is created — the ENGINE reads this, not just what the panel displays.
  it('seeds a newly created node with its schema defaults (append path)', async () => {
    const { result } = setup(steps())
    await waitFor(() => expect(result.current.edges).toHaveLength(1))
    act(() => result.current.insertModule('wait', null))
    expect(result.current.selectedNode!.data.config).toEqual({ skip_weekends: false })
  })

  it('seeds a newly created node with its schema defaults (edge-split path)', async () => {
    const { result } = setup(steps())
    await waitFor(() => expect(result.current.edges).toHaveLength(1))
    const edgeId = result.current.edges[0].id
    act(() => result.current.insertModule('wait', edgeId))
    expect(result.current.selectedNode!.data.config).toEqual({ skip_weekends: false })
  })
})

describe('useWorkflowEditor · deleteNode', () => {
  const chain = (): WorkflowStep[] => [
    { id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 180 }, next: [{ target: 'n2' }] },
    { id: 'n2', type: 'email', config: {}, position: { x: 220, y: 180 }, next: [{ target: 'n3' }] },
    { id: 'n3', type: 'whatsapp', config: {}, position: { x: 440, y: 180 } },
  ]

  it('bridges its in/out neighbours when both exist (a-b-c → a-c)', async () => {
    const { result } = setup(chain())
    await waitFor(() => expect(result.current.edges).toHaveLength(2))
    act(() => result.current.deleteNode('n2'))
    expect(result.current.nodesWithFirst.map(n => n.id)).toEqual(['n1', 'n3'])
    expect(result.current.edges).toEqual([expect.objectContaining({ source: 'n1', target: 'n3' })])
  })

  it('does NOT invent a bridge when the deleted node only has one side connected', async () => {
    const { result } = setup(chain())
    await waitFor(() => expect(result.current.edges).toHaveLength(2))
    act(() => result.current.deleteNode('n1')) // no incoming edge on n1
    expect(result.current.nodesWithFirst.map(n => n.id)).toEqual(['n2', 'n3'])
    expect(result.current.edges).toEqual([expect.objectContaining({ source: 'n2', target: 'n3' })])
  })

  it('clears the selection when the deleted node was selected', async () => {
    const { result } = setup(chain())
    await waitFor(() => expect(result.current.edges).toHaveLength(2))
    act(() => result.current.setSelectedNodeId('n2'))
    act(() => result.current.deleteNode('n2'))
    expect(result.current.selectedNode).toBeNull()
  })
})
