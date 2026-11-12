/** useWorkflowEditor · live run progress, node test-run, step inspector and start hint (split from useWorkflowEditor.test.tsx; same QueryClient harness). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useWorkflowEditor } from './useWorkflowEditor'
import type { Workflow, WorkflowStep } from '@/types/workflow'
import api from '@/lib/api'

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

describe('useWorkflowEditor · NODE-PROGRESS-1 live progress mapping', () => {
  it('maps the polled run steps (status + {done,total} progress + items_total) onto node data', async () => {
    // Route the mocked GET: the polled run for /workflow-runs/r1, [] for the runs-adoption mount fetch.
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

describe('useWorkflowEditor · handleNodeRun', () => {
  it('a candidates node test-step calls the generic /workflows/test-module route with module_type and config', async () => {
    const { result } = setup([
      { id: 'n1', type: 'candidates', config: { limit: 10, filters: { conditions: [{ field: 'status', value: 'Available' }] } }, position: { x: 0, y: 0 } },
    ])

    const mockPost = vi.mocked(api.post)
    mockPost.mockResolvedValueOnce({ data: { output: [{ id: '1', name: 'Alice' }] } })

    await act(async () => {
      await result.current.handleNodeRun('n1', result.current.nodesWithFirst[0].data)
    })

    // WORKFLOW-422: a third options arg ({ quietStatuses: [422] }) now travels
    // on this POST too, so the api.ts dev interceptor doesn't double-toast a
    // 422 the hook already surfaces itself.
    expect(mockPost).toHaveBeenCalledWith('/workflows/test-module', {
      module_type: 'candidates',
      config: { limit: 10, filters: { conditions: [{ field: 'status', value: 'Available' }] } },
    }, { quietStatuses: [422] })
    expect(mockPost).not.toHaveBeenCalledWith(expect.stringContaining('/sm_candidates'), expect.anything())
  })
})

// RUN-INSPECTOR-1b: the canvas node's own run-status marker opens the per-step
// inspector for that node's step of the live run shown in the Logs panel —
// `stepForNode(nodeId)` on `liveRun.steps` (step_id = node id, id = the route's
// {step}) feeds an `onInspect` callback into the node's data, and clicking it
// sets `inspecting` with the run+step ids the panel needs.
describe('useWorkflowEditor · RUN-INSPECTOR-1b stepForNode + inspecting', () => {
  it('gives a node whose run step carries both ids an onInspect that sets inspecting', async () => {
    const run = { id: 'r1', status: 'success', steps: [{ step_id: 'n1', id: 42, status: 'success' }] }
    vi.mocked(api.get).mockImplementation(async (url: string) =>
      url.includes('/workflow-runs/') ? { data: { data: run } } : { data: { data: [] } })
    const { result } = renderHook(
      () => useWorkflowEditor({
        workflow: wf([{ id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 0 } }]),
        onSave: vi.fn(),
        initialRunId: 'r1',
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.nodesWithFirst[0].data.inspectStepId).toBe(42))
    expect(result.current.stepForNode('n1')).toMatchObject({ step_id: 'n1', id: 42 })
    expect(result.current.inspecting).toBeNull()

    act(() => { (result.current.nodesWithFirst[0].data.onInspect as () => void)() })
    expect(result.current.inspecting).toEqual({ runId: 'r1', stepId: 42, nodeId: 'n1' })
  })

  it('gives a node with no run step no onInspect at all', async () => {
    const { result } = setup([{ id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 0 } }])
    await waitFor(() => expect(result.current.nodesWithFirst).toHaveLength(1))
    expect(result.current.nodesWithFirst[0].data.inspectStepId).toBeNull()
    expect(result.current.nodesWithFirst[0].data.onInspect).toBeUndefined()
    expect(result.current.stepForNode('n1')).toBeNull()
  })
})

// VERTREKMODULE-1 proof (CMBE 10-09, point 3): a workflow whose only step is a
// send step has no Koios start module and says so in the header.
describe('useWorkflowEditor · start hint for a send-only workflow', () => {
  it('flags a single whatsapp_send step as an invalid start, and a single entity step as valid', async () => {
    const sendOnly = setup([{ id: 'n1', type: 'whatsapp_send', config: {}, position: { x: 0, y: 0 } }])
    await waitFor(() => expect(sendOnly.result.current.nodesWithFirst).toHaveLength(1))
    expect(sendOnly.result.current.startInvalid).toBe(true)
    const entityOnly = setup([{ id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 0 } }])
    await waitFor(() => expect(entityOnly.result.current.nodesWithFirst).toHaveLength(1))
    expect(entityOnly.result.current.startInvalid).toBe(false)
  })
})
