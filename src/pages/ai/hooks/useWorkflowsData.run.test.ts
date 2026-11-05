/** useWorkflowsData · single run and bulk run (split from useWorkflowsData.test.ts; folder, save and partial-PUT tests stay there). */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWorkflowsData } from './useWorkflowsData'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notify: vi.fn(), notifyError: vi.fn() }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
// Auto-confirm every staged confirmation so archive's confirm-gated call fires
// synchronously in tests, without rendering the real ConfirmDialog.
vi.mock('@/hooks/useConfirm', () => ({
  useConfirm: () => ({ confirm: (_msg: string, onConfirm: () => void) => onConfirm(), dialog: null }),
}))
// Minimal i18n stub that still interpolates {{msg}}-style options, so translated
// messages stay inspectable in the assertions below.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts?.msg ? `${key}::${opts.msg}` : key) }),
}))

import api from '@/lib/api'
import { notify, notifyError } from '@/lib/notify'
const mockedGet    = vi.mocked(api.get)
const mockedPost   = vi.mocked(api.post)

afterEach(() => vi.clearAllMocks())

// One seeded workflow + folder so folder-move / save-existing tests have a real target row.
function seedList() {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/workflows') {
      return Promise.resolve({ data: { data: [
        { id: 'wf-1', name: 'Welcome flow', status: 'active', steps: [{ id: 's1', type: 'email_send' }] },
      ] } })
    }
    if (url === '/workflow-folders') return Promise.resolve({ data: { data: [{ id: 'f1', name: 'Onboarding' }] } })
    return Promise.resolve({ data: { data: [] } })
  })
}

// K-3: handleRun is a workflow-EXECUTION call — it must route through the
// configurable engine base URL (resolveWorkflowBaseURL), same as every other
// run/cancel/logs call, never the bare main-api client.
describe('useWorkflowsData · handleRun (K-3 workflow-execution base URL)', () => {
  it('POSTs /workflows/{id}/run with quietStatuses:[409] and the resolved workflow base URL', async () => {
    seedList()
    mockedPost.mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.handleRun('wf-1') })

    expect(mockedPost).toHaveBeenCalledWith(
      '/workflows/wf-1/run', undefined,
      { quietStatuses: [409], baseURL: expect.any(String), headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) },
    )
  })

  // D8 re-audit: a successful run used to give no feedback at all and never
  // refresh the row — the last-run stamp stayed stale until Cmd+R.
  it('on success: notifies and refetches the list (so the last-run stamp updates)', async () => {
    seedList()
    mockedPost.mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const getCallsBefore = mockedGet.mock.calls.length

    await act(async () => { await result.current.handleRun('wf-1') })

    expect(notify).toHaveBeenCalledWith('success', 'page.runStarted')
    await waitFor(() => expect(mockedGet.mock.calls.length).toBeGreaterThan(getCallsBefore))
  })

  // N007-POINT3-FIX-1: handleRun's own promise must resolve only once the
  // post-success refetch has LANDED, not the moment the POST responds — the
  // card/row's "running" state is built directly on this promise.
  it('on success: the returned promise only resolves after the refetch has landed, not right after the POST', async () => {
    seedList()
    mockedPost.mockResolvedValue({ data: {} })
    let resolveReload!: (v: unknown) => void
    const pendingReload = new Promise(res => { resolveReload = res })
    // The mount's own load (one call to /workflows) resolves normally via seedList
    // (mockImplementationOnce takes priority); every LATER call (the post-run
    // refetch) hangs on pendingReload until resolveReload fires below.
    mockedGet.mockImplementationOnce((url: string) =>
      url === '/workflows'
        ? Promise.resolve({ data: { data: [{ id: 'wf-1', name: 'Welcome flow', status: 'active', steps: [] }] } })
        : Promise.resolve({ data: { data: [] } }))
    mockedGet.mockImplementationOnce((url: string) =>
      url === '/workflow-folders' ? Promise.resolve({ data: { data: [] } }) : pendingReload)
    mockedGet.mockImplementation((url: string) => (url === '/workflows' ? pendingReload : Promise.resolve({ data: { data: [] } })))

    try {
      const { result } = renderHook(() => useWorkflowsData(false))
      await waitFor(() => expect(result.current.loading).toBe(false))

      let settled = false
      const runPromise = result.current.handleRun('wf-1').then(() => { settled = true })

      // Give microtasks a chance to flush the POST — the hook's promise must still be pending.
      await act(async () => { await Promise.resolve(); await Promise.resolve() })
      expect(settled).toBe(false)

      // Now let the refetch land — only then does handleRun's promise resolve.
      await act(async () => { resolveReload({ data: { data: [] } }); await runPromise })
      expect(settled).toBe(true)
    } finally {
      // This test's permanent mockImplementation would otherwise leak into
      // later tests (vi.clearAllMocks() only clears call history, not implementations).
      mockedGet.mockReset()
    }
  })

  it('on failure: notifies the specific backend reason, no refetch bump', async () => {
    seedList()
    mockedPost.mockRejectedValue({ response: { status: 422, data: { message: 'Workflow is niet actief' } } })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.handleRun('wf-1') })

    expect(notifyError).toHaveBeenCalledWith('Workflow is niet actief')
    expect(notify).not.toHaveBeenCalled()
  })

  // N007-POINT3-FIX-1 verifier fix: a FAILED run must resolve `false` so
  // runWithDoneFlash never flashes "just started" over a run that never ran.
  it('on a 422: handleRun resolves false', async () => {
    seedList()
    mockedPost.mockRejectedValue({ response: { status: 422, data: { message: 'Workflow is niet actief' } } })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let runResult: boolean | undefined
    await act(async () => { runResult = await result.current.handleRun('wf-1') })

    expect(runResult).toBe(false)
  })

  // N007-POINT3-FIX-1 verifier fix: the real screen keeps the row list mounted
  // during the post-run refetch (WorkflowsListPanel swaps the whole grid for a
  // spinner on `loading`, which would unmount every row's running/justRan state).
  it('on success: `loading` stays false for the whole post-run refetch (silent reload)', async () => {
    seedList()
    mockedPost.mockResolvedValue({ data: {} })
    let resolveReload!: (v: unknown) => void
    const pendingReload = new Promise(res => { resolveReload = res })
    mockedGet.mockImplementationOnce((url: string) =>
      url === '/workflows'
        ? Promise.resolve({ data: { data: [{ id: 'wf-1', name: 'Welcome flow', status: 'active', steps: [] }] } })
        : Promise.resolve({ data: { data: [] } }))
    mockedGet.mockImplementationOnce((url: string) =>
      url === '/workflow-folders' ? Promise.resolve({ data: { data: [] } }) : pendingReload)
    mockedGet.mockImplementation((url: string) => (url === '/workflows' ? pendingReload : Promise.resolve({ data: { data: [] } })))

    try {
      const { result } = renderHook(() => useWorkflowsData(false))
      await waitFor(() => expect(result.current.loading).toBe(false))

      const loadingSnapshots: boolean[] = []
      act(() => { void result.current.handleRun('wf-1') })
      await act(async () => { await Promise.resolve(); await Promise.resolve() })
      loadingSnapshots.push(result.current.loading)

      await act(async () => { resolveReload({ data: { data: [] } }); await Promise.resolve() })
      loadingSnapshots.push(result.current.loading)

      expect(loadingSnapshots).toEqual([false, false])
    } finally {
      mockedGet.mockReset()
    }
  })
})

// S1 Lane C (CONTRACT-CHANGELOG 2026-09-04): POST /workflows/{id}/run-bulk —
// count-then-confirm above the threshold (via this hook's own confirm dialog),
// straight through below it. Mutation tests assert the REQUEST, never only the callback (§13).
describe('useWorkflowsData · handleRunBulk (S1 run-bulk confirm)', () => {
  it('202: POSTs run-bulk with no body and toasts the started count', async () => {
    seedList()
    mockedPost.mockResolvedValue({ data: { run_id: 'rb1', count: 12 } })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.handleRunBulk('wf-1') })

    expect(mockedPost).toHaveBeenCalledWith(
      '/workflows/wf-1/run-bulk', undefined,
      { quietStatuses: [409], baseURL: expect.any(String), headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) },
    )
    expect(notify).toHaveBeenCalledWith('success', 'page.runBulkStarted')
  })

  // REPAIR M1: WorkflowController::runBulk() throws TWO different 409 shapes —
  // this one (WorkflowAlreadyRunningException, {message, run_id}) must NEVER be
  // read as the threshold shape, or an already-running workflow shows "raakt 0
  // records (drempel 0)" and re-POSTs forever. Mirrors handleRun's own 409
  // feedback exactly: toast + open the builder on the live run, no confirm().
  it('409 single-flight (already running): toasts + opens the builder on the live run, never the confirm dialog', async () => {
    seedList()
    mockedPost.mockRejectedValue({ response: { status: 409, data: { message: 'loopt al', run_id: 'r-existing' } } })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.handleRunBulk('wf-1') })

    expect(notify).toHaveBeenCalledWith('info', 'runControl.alreadyRunning')
    expect(result.current.editingWorkflow?.id).toBe('wf-1')
    expect(result.current.focusRunId).toBe('r-existing')
    // Never mistaken for the threshold shape: exactly the ONE call this test made.
    expect(mockedPost).toHaveBeenCalledTimes(1)
  })

  it('409 above the threshold: opens the confirm dialog, then re-POSTs {confirm:true}', async () => {
    seedList()
    mockedPost
      .mockRejectedValueOnce({ response: { status: 409, data: { count: 40, matched_records: 40, threshold: 25 } } })
      .mockResolvedValueOnce({ data: { run_id: 'rb2', count: 40 } })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.handleRunBulk('wf-1') })

    expect(mockedPost).toHaveBeenNthCalledWith(
      1, '/workflows/wf-1/run-bulk', undefined,
      { quietStatuses: [409], baseURL: expect.any(String), headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) },
    )
    await waitFor(() => expect(mockedPost).toHaveBeenNthCalledWith(
      2, '/workflows/wf-1/run-bulk', { confirm: true },
      { quietStatuses: [409], baseURL: expect.any(String), headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) },
    ))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', 'page.runBulkStarted'))
  })

  // N3: routes through extractApiError (the REAL implementation here — only
  // @/lib/api is mocked) rather than a flat fallback, so the specific backend
  // reason reaches the user, same as handleSave/deleteFolder already do (§10).
  it('a non-409 failure notifies the SPECIFIC backend reason (extractApiError), never opens the confirm dialog', async () => {
    seedList()
    mockedPost.mockRejectedValue({ response: { status: 422, data: { message: 'Workflow is niet actief' } } })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.handleRunBulk('wf-1') })

    expect(notifyError).toHaveBeenCalledWith('Workflow is niet actief')
    expect(notify).not.toHaveBeenCalled()
  })

  // A network-style failure with no server message falls back to the i18n default,
  // mirroring extractApiError's own contract (never a raw axios/network string, §10).
  it('a network-style failure (no server message) falls back to the i18n default', async () => {
    seedList()
    mockedPost.mockRejectedValue(new Error('Request failed with status code 500'))
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.handleRunBulk('wf-1') })

    expect(notifyError).toHaveBeenCalledWith('common:actionFailed')
  })
})
