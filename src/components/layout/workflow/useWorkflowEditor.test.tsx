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
import api from '@/lib/api'

// The mount effect fetches /webhooks through the default client — stub it, but
// keep the real unwrap/unwrapList (importActual) so that call still resolves cleanly.
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

describe('useWorkflowEditor · handleSave payload (denormalized per trigger)', () => {
  it('Manual trigger: no trigger_config; steps mirror flowToSteps(nodes, edges) exactly', async () => {
    const { result, onSave } = setup([{ id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 0 } }])
    await waitFor(() => expect(result.current.nodesWithFirst).toHaveLength(1))
    act(() => result.current.handleSave())
    expect(onSave).toHaveBeenCalledTimes(1)
    const [payload, closeAfter] = onSave.mock.calls[0]
    expect(closeAfter).toBe(false)
    expect(payload.trigger_config).toBeUndefined()
    expect(payload.status).toBe('draft')
    expect(payload.steps).toEqual([{ id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 0 }, next: [] }])
  })

  it('Webhook trigger: handleSave(true) passes closeAfter through and sets trigger_config.webhook_id', async () => {
    const { result, onSave } = setup(
      [{ id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 0 } }],
      { trigger: 'Webhook', trigger_config: { webhook_id: 'wh1' } },
    )
    await waitFor(() => expect(result.current.nodesWithFirst).toHaveLength(1))
    act(() => result.current.handleSave(true))
    const [payload, closeAfter] = onSave.mock.calls[0]
    expect(closeAfter).toBe(true)
    expect(payload.trigger_config).toEqual({ webhook_id: 'wh1' })
  })

  // AI-AGENTS-3: a webhook trigger's AI-agent flavor carries { agent } in
  // trigger_config, checked BEFORE the legacy webhook_id flavor (both share the
  // 'Webhook' trigger label) so the new flow never falls through to an empty config.
  it('Webhook trigger (AI-agent flavor): trigger_config carries the agent name set via setScheduleConfig', async () => {
    const { result, onSave } = setup(
      [{ id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 0 } }],
      { trigger: 'Webhook' },
    )
    await waitFor(() => expect(result.current.nodesWithFirst).toHaveLength(1))
    act(() => result.current.setScheduleConfig({ schedule_type: 'webhook', agent: 'Michelle' }))
    act(() => result.current.handleSave())
    const [payload] = onSave.mock.calls[0]
    expect(payload.trigger_config).toEqual({ agent: 'Michelle' })
  })

  // Reload seeding: the backend persists trigger_config.agent FLAT (no nested
  // `schedule` key) — an immediate re-save right after loading (no ScheduleModal
  // reopen in between) must still preserve the binding instead of silently
  // wiping it, the exact class of bug this whole branch order guards against.
  it('Webhook trigger (AI-agent flavor): a reloaded workflow keeps trigger_config.agent on an immediate re-save', async () => {
    const { result, onSave } = setup(
      [{ id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 0 } }],
      { trigger: 'Webhook', trigger_config: { agent: 'Michelle' } },
    )
    await waitFor(() => expect(result.current.nodesWithFirst).toHaveLength(1))
    act(() => result.current.handleSave())
    const [payload] = onSave.mock.calls[0]
    expect(payload.trigger_config).toEqual({ agent: 'Michelle' })
  })

  it('Scheduled trigger: trigger_config carries the live schedule config set via setScheduleConfig', async () => {
    const { result, onSave } = setup(
      [{ id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 0 } }],
      { trigger: 'Scheduled' },
    )
    await waitFor(() => expect(result.current.nodesWithFirst).toHaveLength(1))
    act(() => result.current.setScheduleConfig({ schedule_type: 'daily', time: '08:00' }))
    act(() => result.current.handleSave())
    const [payload] = onSave.mock.calls[0]
    expect(payload.trigger_config).toEqual({ schedule: { schedule_type: 'daily', time: '08:00' } })
  })

  // BIRTHDAY-FLOW-2: an Event trigger's payload must carry ONLY { event: <key> } in
  // trigger_config — the exact shape WorkflowDispatcher::dispatch reads on the backend
  // (Workflow::trigger_config['event']), never nested under a `schedule` key.
  it('Event trigger: trigger_config carries only the event key set via setScheduleConfig', async () => {
    const { result, onSave } = setup(
      [{ id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 0 } }],
      { trigger: 'Event' },
    )
    await waitFor(() => expect(result.current.nodesWithFirst).toHaveLength(1))
    act(() => result.current.setScheduleConfig({ schedule_type: 'event', event: 'candidate.birthday' }))
    act(() => result.current.handleSave())
    const [payload] = onSave.mock.calls[0]
    expect(payload.trigger_config).toEqual({ event: 'candidate.birthday' })
  })
})

describe('useWorkflowEditor · isDirty (dirty-check baseline)', () => {
  it('is false right after load, true after an edit, and false again right after a save', async () => {
    const { result } = setup([{ id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 0 } }])
    await waitFor(() => expect(result.current.nodesWithFirst).toHaveLength(1))
    expect(result.current.isDirty()).toBe(false)
    act(() => result.current.updateNodeConfig('n1', 'limit', 5))
    expect(result.current.isDirty()).toBe(true)
    act(() => result.current.handleSave())
    expect(result.current.isDirty()).toBe(false)
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

describe('useWorkflowEditor · NODE-PROGRESS-1 live progress mapping', () => {
  it('maps the polled run steps (status + {done,total} progress + items_total) onto node data', async () => {
    // Route the mocked GET: the polled run for /workflow-runs/r1, [] for the webhooks mount fetch.
    const run = {
      id: 'r1', status: 'running',
      steps: [
        { step_id: 'n1', status: 'running', progress: { done: 38, total: 120 }, items_total: null },
        { step_id: 'n2', status: 'success', progress: null, items_total: 57 },
      ],
    }
    vi.mocked(api.get).mockImplementation(async (url: string) =>
      url.includes('/workflow-runs/') ? { data: { data: run } } : { data: { data: [] } })

    const steps: WorkflowStep[] = [
      { id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 180 }, next: [{ target: 'n2' }] },
      { id: 'n2', type: 'email', config: {}, position: { x: 220, y: 180 } },
    ]
    const { result } = renderHook(
      () => useWorkflowEditor({ workflow: wf(steps), onSave: vi.fn(), initialRunId: 'r1' }), { wrapper })

    // The poll lands → each node carries its live status, progress and item count,
    // plus runActive (the run is still live, so a sub-100% arc may keep filling).
    await waitFor(() => {
      const n1 = result.current.nodesWithFirst.find(n => n.id === 'n1')
      const n2 = result.current.nodesWithFirst.find(n => n.id === 'n2')
      expect(n1?.data).toMatchObject({ status: 'running', isRunning: true, progress: { done: 38, total: 120 }, runActive: true })
      expect(n2?.data).toMatchObject({ status: 'success', progress: null, itemsTotal: 57 })
    })
  })

  it('marks runActive false on a terminal run so a partial arc can never freeze', async () => {
    // Terminal run whose fan-out step stopped short (12/40): the badge data stays,
    // but runActive=false tells the canvas to drop the (now frozen) partial arc.
    const run = {
      id: 'r2', status: 'success',
      steps: [{ step_id: 'n1', status: 'success', progress: { done: 12, total: 40 }, items_total: 40 }],
    }
    vi.mocked(api.get).mockImplementation(async (url: string) =>
      url.includes('/workflow-runs/') ? { data: { data: run } } : { data: { data: [] } })

    const { result } = renderHook(
      () => useWorkflowEditor({
        workflow: wf([{ id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 0 } }]),
        onSave: vi.fn(), initialRunId: 'r2',
      }), { wrapper })

    await waitFor(() => {
      const n1 = result.current.nodesWithFirst.find(n => n.id === 'n1')
      expect(n1?.data).toMatchObject({ status: 'success', progress: { done: 12, total: 40 }, runActive: false })
    })
  })
})
