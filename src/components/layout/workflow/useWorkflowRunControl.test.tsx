/**
 * useWorkflowRunControl — regression test for the RUN-CONTROL-1 409 single-flight
 * path (extracted from useWorkflowEditor, split at ~400 lines, §3): starting a
 * run that is already running must point the viewer at the EXISTING run (not
 * fail silently), flag `runConflict`, and still open the run viewer — mirroring
 * a clean start. A genuine (non-409) failure must NOT do any of that.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { act } from 'react'
import { useWorkflowRunControl } from './useWorkflowRunControl'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'

vi.mock('@/lib/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }))
// WORKFLOW-422: keep the i18n fallback quiet in tests (no i18next instance is
// booted in this suite) while still returning the key so we can assert on it.
vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
  return { ...actual, useTranslation: () => ({ t: (k: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? k, i18n: { language: 'nl' } }) }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
const mockedPost = vi.mocked(api.post)
const mockedGet  = vi.mocked(api.get)

afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs() })

// Fresh QueryClient per render — no cross-test cache bleed, no retries slowing failures.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useWorkflowRunControl', () => {
  it('starts a run: sets activeRunId from the response and fires onRunStarted', async () => {
    // K-3: pin the EXACT resolved base URL here, not just "a string" — the
    // other assertions in this file stay expect.any(String) (route/body shape
    // is what they cover).
    vi.stubEnv('VITE_WORKFLOW_API_URL', 'http://engine.test/api')
    mockedPost.mockResolvedValue({ data: { run: { id: 'r1' } } })
    mockedGet.mockResolvedValue({ data: { id: 'r1', status: 'running' } })
    const onRunStarted = vi.fn()
    const { result } = renderHook(
      () => useWorkflowRunControl({ workflowId: 'w1', onRunStarted }),
      { wrapper },
    )

    await act(async () => { await result.current.handleRun() })

    expect(mockedPost).toHaveBeenCalledWith('/workflows/w1/run', undefined, { quietStatuses: [409, 422], baseURL: 'http://engine.test/api' })
    expect(result.current.activeRunId).toBe('r1')
    expect(result.current.runConflict).toBe(false)
    expect(result.current.runError).toBeNull()
    expect(onRunStarted).toHaveBeenCalledTimes(1)
  })

  // WF-DRYRUN-FE-1: the dry-run action posts the SAME route with {dry_run:true}
  // pinned in the body — never a different endpoint or param name.
  it('dry run: POSTs {dry_run:true} on the same route/port', async () => {
    mockedPost.mockResolvedValue({ data: { run: { id: 'r3' } } })
    mockedGet.mockResolvedValue({ data: { id: 'r3', status: 'success', dry_run: true } })
    const onRunStarted = vi.fn()
    const { result } = renderHook(
      () => useWorkflowRunControl({ workflowId: 'w1', onRunStarted }),
      { wrapper },
    )

    await act(async () => { await result.current.handleRun({ dryRun: true }) })

    expect(mockedPost).toHaveBeenCalledWith('/workflows/w1/run', { dry_run: true }, { quietStatuses: [409, 422], baseURL: expect.any(String) })
    expect(result.current.activeRunId).toBe('r3')
  })

  it('409 "already running": points activeRunId at the EXISTING run, flags runConflict, still opens the viewer', async () => {
    mockedPost.mockRejectedValue({ response: { status: 409, data: { message: 'loopt al', run_id: 'r-existing' } } })
    const onRunStarted = vi.fn()
    const { result } = renderHook(
      () => useWorkflowRunControl({ workflowId: 'w1', onRunStarted }),
      { wrapper },
    )

    await act(async () => { await result.current.handleRun() })

    expect(result.current.activeRunId).toBe('r-existing')
    expect(result.current.runConflict).toBe(true)
    expect(result.current.runError).toBeNull()
    expect(result.current.running).toBe(false)
    expect(onRunStarted).toHaveBeenCalledTimes(1)
  })

  it('a non-409 failure surfaces the backend message, toasts it, and never sets runConflict', async () => {
    mockedPost.mockRejectedValue({ response: { status: 422, data: { message: 'Workflow is niet actief' } } })
    const onRunStarted = vi.fn()
    const { result } = renderHook(
      () => useWorkflowRunControl({ workflowId: 'w1', onRunStarted }),
      { wrapper },
    )

    await act(async () => { await result.current.handleRun() })

    expect(result.current.runError).toBe('Workflow is niet actief')
    expect(result.current.runConflict).toBe(false)
    expect(result.current.activeRunId).toBeNull()
    expect(onRunStarted).not.toHaveBeenCalled()
    // WORKFLOW-422: toast and visible header state carry the SAME string.
    expect(notifyError).toHaveBeenCalledWith('Workflow is niet actief')
  })

  // WORKFLOW-422 (Danny 09-09, "Kan niet via whatsapp web berichten versturen
  // via de agent"): a 422 carrying only a Laravel validation bag (no top-level
  // message) must still surface the real reason on the toast AND runError —
  // both read through the SAME extractApiError call.
  it('a 422 validation-bag failure (no top-level message) surfaces the field error via runError and the toast', async () => {
    mockedPost.mockRejectedValue({
      response: { status: 422, data: { errors: { number: ['Geen actief WhatsApp-nummer.'] } } },
    })
    const { result } = renderHook(
      () => useWorkflowRunControl({ workflowId: 'w1' }),
      { wrapper },
    )

    await act(async () => { await result.current.handleRun() })

    expect(result.current.runError).toBe('Geen actief WhatsApp-nummer.')
    expect(notifyError).toHaveBeenCalledWith('Geen actief WhatsApp-nummer.')
  })

  // PRIJSMODEL-C 30-08: a 422 { status: 'budget_exceeded', budget } keeps
  // rendering the server message as-is (unchanged behaviour) AND exposes the
  // staffel stand separately so the header can show the upgrade hint.
  it('budget_exceeded: keeps the message and exposes runBudget', async () => {
    mockedPost.mockRejectedValue({
      response: { status: 422, data: {
        message: 'Workflow-staffel is vol.', status: 'budget_exceeded',
        budget: { state: 'blocked', allowance: 100, used: 100, remaining: 0, unit: 'workflow_run', upgrade_hint: { next_tier_key: 'pro', next_tier_label: 'Pro' } },
      } },
    })
    const { result } = renderHook(
      () => useWorkflowRunControl({ workflowId: 'w1' }),
      { wrapper },
    )

    await act(async () => { await result.current.handleRun() })

    expect(result.current.runError).toBe('Workflow-staffel is vol.')
    expect(result.current.runConflict).toBe(false)
    expect(result.current.runBudget).toEqual({
      state: 'blocked', allowance: 100, used: 100, remaining: 0, unit: 'workflow_run', upgrade_hint: { next_tier_key: 'pro', next_tier_label: 'Pro' },
    })
  })

  it('handleStopped clears a prior conflict/error so the workflow can be re-run', async () => {
    mockedPost.mockRejectedValue({ response: { status: 409, data: { message: 'loopt al', run_id: 'r-existing' } } })
    const { result } = renderHook(
      () => useWorkflowRunControl({ workflowId: 'w1' }),
      { wrapper },
    )

    await act(async () => { await result.current.handleRun() })
    expect(result.current.runConflict).toBe(true)

    act(() => result.current.handleStopped())
    expect(result.current.runConflict).toBe(false)
    expect(result.current.runError).toBeNull()
  })

  it('waitFor: liveRunActive reflects a running/waiting poll result for the active run', async () => {
    mockedPost.mockResolvedValue({ data: { run: { id: 'r2' } } })
    mockedGet.mockResolvedValue({ data: { id: 'r2', status: 'waiting' } })
    const { result } = renderHook(
      () => useWorkflowRunControl({ workflowId: 'w1' }),
      { wrapper },
    )

    await act(async () => { await result.current.handleRun() })
    await waitFor(() => expect(result.current.liveRunActive).toBe(true))
  })

  // S1 Lane C: `subject` optionally seeds the run context with one record —
  // posted on the SAME /run route/body shape as dry_run, never a separate call.
  it('handleRun({ subject }): POSTs {subject} on the same route', async () => {
    mockedPost.mockResolvedValue({ data: { run: { id: 'r4' } } })
    mockedGet.mockResolvedValue({ data: { id: 'r4', status: 'success' } })
    const { result } = renderHook(
      () => useWorkflowRunControl({ workflowId: 'w1' }),
      { wrapper },
    )

    await act(async () => { await result.current.handleRun({ subject: { entity_type: 'candidate', entity_id: 'c1' } }) })

    expect(mockedPost).toHaveBeenCalledWith(
      '/workflows/w1/run',
      { subject: { entity_type: 'candidate', entity_id: 'c1' } },
      { quietStatuses: [409, 422], baseURL: expect.any(String) },
    )
  })
})

// S1 Lane C (CONTRACT-CHANGELOG 2026-09-04): POST /workflows/{id}/run-bulk —
// count-then-confirm above the tenant's threshold, straight through below it.
describe('useWorkflowRunControl · runBulk', () => {
  it('202: adopts the started run and returns {status:"started", runId, count}', async () => {
    mockedPost.mockResolvedValue({ data: { run_id: 'rb1', count: 12 } })
    mockedGet.mockResolvedValue({ data: { id: 'rb1', status: 'running' } })
    const onRunStarted = vi.fn()
    const { result } = renderHook(
      () => useWorkflowRunControl({ workflowId: 'w1', onRunStarted }),
      { wrapper },
    )

    let outcome
    await act(async () => { outcome = await result.current.runBulk() })

    expect(mockedPost).toHaveBeenCalledWith('/workflows/w1/run-bulk', undefined, { quietStatuses: [409, 422], baseURL: expect.any(String) })
    expect(outcome).toEqual({ status: 'started', runId: 'rb1', count: 12 })
    expect(result.current.activeRunId).toBe('rb1')
    expect(onRunStarted).toHaveBeenCalledTimes(1)
  })

  // REPAIR M1: WorkflowController::runBulk() throws TWO different 409 shapes —
  // this one (WorkflowAlreadyRunningException, {message, run_id}) must NEVER be
  // read as the threshold shape, or an already-running workflow shows "raakt 0
  // records (drempel 0)" and the caller re-POSTs forever. No confirm number, no
  // re-POST — adopt the live run exactly like handleRun's own 409 branch does.
  it('409 single-flight (already running): adopts the run, never reads it as a threshold confirm', async () => {
    mockedPost.mockRejectedValue({ response: { status: 409, data: { message: 'loopt al', run_id: 'r-existing' } } })
    const onRunStarted = vi.fn()
    const { result } = renderHook(
      () => useWorkflowRunControl({ workflowId: 'w1', onRunStarted }),
      { wrapper },
    )

    let outcome
    await act(async () => { outcome = await result.current.runBulk() })

    expect(outcome).toEqual({ status: 'already_running', runId: 'r-existing' })
    expect(result.current.activeRunId).toBe('r-existing')
    expect(result.current.runConflict).toBe(true)
    expect(onRunStarted).toHaveBeenCalledTimes(1)
    // Never mistaken for the threshold shape: no confirm() re-POST should follow —
    // only the ONE call this test itself made.
    expect(mockedPost).toHaveBeenCalledTimes(1)
  })

  it('409 above the threshold: returns the numbers, never starts a run', async () => {
    mockedPost.mockRejectedValue({ response: { status: 409, data: { count: 40, matched_records: 40, threshold: 25 } } })
    const onRunStarted = vi.fn()
    const { result } = renderHook(
      () => useWorkflowRunControl({ workflowId: 'w1', onRunStarted }),
      { wrapper },
    )

    let outcome
    await act(async () => { outcome = await result.current.runBulk() })

    expect(outcome).toEqual({ status: 'confirm', count: 40, matchedRecords: 40, threshold: 25 })
    expect(result.current.activeRunId).toBeNull()
    expect(onRunStarted).not.toHaveBeenCalled()
  })

  it('confirm re-POST: sends {confirm:true} and starts the run', async () => {
    mockedPost.mockResolvedValue({ data: { run_id: 'rb2', count: 40 } })
    mockedGet.mockResolvedValue({ data: { id: 'rb2', status: 'running' } })
    const { result } = renderHook(
      () => useWorkflowRunControl({ workflowId: 'w1' }),
      { wrapper },
    )

    let outcome
    await act(async () => { outcome = await result.current.runBulk({ confirm: true }) })

    expect(mockedPost).toHaveBeenCalledWith('/workflows/w1/run-bulk', { confirm: true }, { quietStatuses: [409, 422], baseURL: expect.any(String) })
    expect(outcome).toEqual({ status: 'started', runId: 'rb2', count: 40 })
  })

  it('a non-409 failure surfaces the backend message via runError and toasts it', async () => {
    mockedPost.mockRejectedValue({ response: { status: 422, data: { message: 'Workflow is niet actief' } } })
    const { result } = renderHook(
      () => useWorkflowRunControl({ workflowId: 'w1' }),
      { wrapper },
    )

    let outcome
    await act(async () => { outcome = await result.current.runBulk() })

    expect(outcome).toEqual({ status: 'error', message: 'Workflow is niet actief' })
    expect(result.current.runError).toBe('Workflow is niet actief')
    // WORKFLOW-422: item (c) — toast and visible state carry the same string.
    expect(notifyError).toHaveBeenCalledWith('Workflow is niet actief')
  })
})
