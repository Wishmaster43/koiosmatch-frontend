/** useWorkflowEditor · save payload and dirty-check (split from useWorkflowEditor.test.tsx; same QueryClient harness). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
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

beforeEach(() => vi.clearAllMocks())

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
    act(() => result.current.setScheduleConfig({ frequency: 'daily', times: ['08:00'] }))
    act(() => result.current.handleSave())
    const [payload] = onSave.mock.calls[0]
    expect(payload.trigger_config).toEqual({ frequency: 'daily', times: ['08:00'] })
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

  // Regression (repair round): useWorkflowGraph defers edges past the first render
  // (a mount effect, so ReactFlow handles exist in the DOM first) — a dirty-check
  // baseline seeded from the live `edges` on first render freezes a zero-edge
  // snapshot, so a workflow that HAS a connection reads dirty the instant the real
  // edges land, one tick later. The fix seeds the baseline from useWorkflowGraph's
  // pre-deferral `initialEdges` instead, which are available synchronously.
  it('stays clean after the deferred-edges effect settles, for a workflow with a connection', async () => {
    const { result } = setup([
      { id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 0 }, next: [{ target: 'n2' }] },
      { id: 'n2', type: 'email', config: {}, position: { x: 220, y: 0 } },
    ])
    await waitFor(() => expect(result.current.edges).toHaveLength(1))
    expect(result.current.isDirty()).toBe(false)
  })
})
