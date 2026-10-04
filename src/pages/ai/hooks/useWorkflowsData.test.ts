/**
 * useWorkflowsData — regression tests for re-audit findings that moved along with
 * the WorkflowsPage extraction: createFolder/moveToFolder used to fail SILENTLY
 * (unlike the sibling handleToggleStatus rollback, which toasts), and handleSave
 * used to interpolate the RAW axios/network message into the user-facing alert
 * instead of routing it through the shared extractApiError helper (§10 — never
 * leak a raw server/axios string to the UI). `unwrap`/`unwrapList` stay the real
 * (pure) implementations; only the axios-like client is mocked.
 *
 * D8 re-audit (14-09): handleSave/the add-module guard used window.alert() —
 * a blocking native dialog instead of the house toast every other mutation in
 * this hook uses; handleRun's success path was empty (no feedback, no refetch);
 * and the list-load effect had no alive guard. All three fixed below.
 */
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
// Minimal i18n stub that still interpolates {{msg}}-style options so handleSave's
// notifyError(t('page.saveFailed', { msg })) stays inspectable in the assertions below.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts?.msg ? `${key}::${opts.msg}` : key) }),
}))

import api from '@/lib/api'
import { notify, notifyError } from '@/lib/notify'
const mockedGet    = vi.mocked(api.get)
const mockedPost   = vi.mocked(api.post)
const mockedPut    = vi.mocked(api.put)
const mockedDelete = vi.mocked(api.delete)

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

describe('useWorkflowsData · createFolder failure feedback', () => {
  it('notifies on a failed create instead of failing silently (finding: catch-noop)', async () => {
    seedList()
    mockedPost.mockRejectedValue(new Error('Request failed with status code 500'))
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.createFolder('New folder') })

    expect(notifyError).toHaveBeenCalledWith('common:actionFailed')
  })
})

describe('useWorkflowsData · moveToFolder failure feedback', () => {
  it('rolls back the optimistic move AND notifies (mirrors handleToggleStatus, was a silent rollback)', async () => {
    seedList()
    mockedPut.mockRejectedValue(new Error('Request failed with status code 500'))
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.moveToFolder('wf-1', 'f1') })

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('common:actionFailed'))
    expect(result.current.workflows.find(w => w.id === 'wf-1')?.folder_id).toBeUndefined()
  })
})

describe('useWorkflowsData · handleSave error message (never raw axios/network text)', () => {
  it('falls back through extractApiError + i18n fallback for a network-style failure', async () => {
    seedList()
    mockedPut.mockRejectedValue(new Error('Request failed with status code 500'))
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleSave({ id: 'wf-1', name: 'Welcome flow', status: 'active', steps: [{ id: 's1', type: 'email_send' }] })
    })

    // The raw axios message ("Request failed with status code 500") must never reach the user,
    // and it goes through the house toast (notifyError), never a blocking window.alert (D8 re-audit).
    expect(notifyError).toHaveBeenCalledWith('page.saveFailed::common:actionFailed')
  })

  it('still surfaces the specific 422 validation detail (WF-R2 functional flow preserved)', async () => {
    seedList()
    mockedPut.mockRejectedValue({ response: { data: { message: 'The given data was invalid.', errors: { steps: ['Step 2 has no connection.'] } } } })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleSave({ id: 'wf-1', name: 'Welcome flow', status: 'active', steps: [{ id: 's1', type: 'email_send' }] })
    })

    expect(notifyError).toHaveBeenCalledWith('page.saveFailed::Step 2 has no connection.')
  })

  it('surfaces a flat 422 message (no errors bag) verbatim — X-22 webhook_send validation', async () => {
    seedList()
    mockedPut.mockRejectedValue({ response: { data: { message: "Stap 2 ('Stuur naar Elanza'): De webhook-URL mag niet naar een intern of privé-adres wijzen." } } })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleSave({ id: 'wf-1', name: 'Welcome flow', status: 'active', steps: [{ id: 's1', type: 'webhook_send' }] })
    })

    expect(notifyError).toHaveBeenCalledWith("page.saveFailed::Stap 2 ('Stuur naar Elanza'): De webhook-URL mag niet naar een intern of privé-adres wijzen.")
  })

  // INTERVIEW-FLAG-1: the BE's fixed-key 422 (is_interview without an agent step)
  // maps to its own i18n key, never showing the raw backend message.
  it('maps the workflow.interview_requires_agent_step 422 to its own i18n key', async () => {
    seedList()
    mockedPut.mockRejectedValue({ response: { data: { message: 'workflow.interview_requires_agent_step' } } })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleSave({ id: 'wf-1', name: 'Welcome flow', status: 'active', is_interview: true, steps: [{ id: 's1', type: 'email_send' }] })
    })

    expect(notifyError).toHaveBeenCalledWith('page.saveFailed::editor.interviewRequiresAgentStep')
  })

  // INTERVIEW-FLAG-1: is_interview rides verbatim in the PUT body at the real seam
  // (denormalizeWorkflow -> api.put), not only one layer up in the onSave argument.
  it('sends is_interview in the PUT body when the workflow carries it', async () => {
    seedList()
    mockedPut.mockResolvedValue({ data: { data: { id: 'wf-1' } } })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleSave({ id: 'wf-1', name: 'Welcome flow', status: 'active', is_interview: true, steps: [{ id: 's1', type: 'email_send' }] })
    })

    expect(mockedPut).toHaveBeenCalledWith('/workflows/wf-1', expect.objectContaining({ is_interview: true }))
  })

  // D8 re-audit: the empty-graph guard used window.alert() too — now the house
  // 'info' toast, matching every other non-error notice in this hook.
  it('the empty-graph guard notifies via the house toast, not window.alert', async () => {
    seedList()
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let saved: boolean | undefined
    await act(async () => {
      saved = await result.current.handleSave({ id: 'wf-1', name: 'Welcome flow', status: 'active', steps: [] })
    })

    expect(saved).toBe(false)
    expect(notify).toHaveBeenCalledWith('info', 'page.addModuleAlert')
    expect(mockedPut).not.toHaveBeenCalled()
  })
})

// TRASH-OVERAL-1b: DELETE = archive (soft-delete), POST .../restore reverses it.
// Mutation tests assert the REQUEST (method/route), never only that a callback fired (§13).
describe('useWorkflowsData · handleArchive / handleRestore (TRASH-OVERAL-1b)', () => {
  it('archives via DELETE /workflows/{id} and refetches on success', async () => {
    seedList()
    mockedDelete.mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const getCallsBefore = mockedGet.mock.calls.length

    await act(async () => { result.current.handleArchive(result.current.workflows[0]) })

    expect(mockedDelete).toHaveBeenCalledWith('/workflows/wf-1')
    expect(notify).toHaveBeenCalledWith('success', 'page.archiveSuccess')
    await waitFor(() => expect(mockedGet.mock.calls.length).toBeGreaterThan(getCallsBefore))
  })

  it('notifies (never silent) when the archive request fails', async () => {
    seedList()
    mockedDelete.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { result.current.handleArchive(result.current.workflows[0]) })

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('common:actionFailed'))
  })

  it('restores via POST /workflows/{id}/restore and refetches on success', async () => {
    seedList()
    mockedPost.mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useWorkflowsData(true))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const getCallsBefore = mockedGet.mock.calls.length

    await act(async () => { await result.current.handleRestore(result.current.workflows[0]) })

    expect(mockedPost).toHaveBeenCalledWith('/workflows/wf-1/restore', undefined, expect.objectContaining({
      headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
    }))
    expect(notify).toHaveBeenCalledWith('success', 'page.restoreSuccess')
    await waitFor(() => expect(mockedGet.mock.calls.length).toBeGreaterThan(getCallsBefore))
  })

  it('notifies (never silent) when the restore request fails', async () => {
    seedList()
    mockedPost.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useWorkflowsData(true))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.handleRestore(result.current.workflows[0]) })

    expect(notifyError).toHaveBeenCalledWith('common:actionFailed')
  })
})

// The list fetch itself is the naad this contract runs over — the archived toggle
// must actually reach the request, not just filter client-side (mirrors the
// candidate/customer include_archived requests below).
describe('useWorkflowsData · list fetch carries include_archived on the request', () => {
  it('omits include_archived when the archived view is off', async () => {
    seedList()
    renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/workflows', { params: {} }))
  })

  it('sends include_archived=1 when the archived view is on', async () => {
    seedList()
    renderHook(() => useWorkflowsData(true))
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/workflows', { params: { include_archived: 1 } }))
  })
})

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

// D8 re-audit: the workflows+folders load effect had no alive/abort guard, so a
// stale response from a slower earlier fetch could overwrite a faster later one
// (fast showArchived toggling) and setState could fire after unmount.
describe('useWorkflowsData · list load effect alive guard', () => {
  it('a slower FIRST fetch never overwrites a faster LATER one after showArchived flips', async () => {
    let resolveFirst!: (v: unknown) => void
    const first = new Promise(res => { resolveFirst = res })
    mockedGet.mockImplementationOnce((url: string) =>
      url === '/workflows' ? first : Promise.resolve({ data: { data: [] } }))

    const { result, rerender } = renderHook(({ archived }) => useWorkflowsData(archived), { initialProps: { archived: false } })

    // Flip before the first (slow) fetch resolves — seeds the second, faster fetch.
    seedList()
    rerender({ archived: true })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.workflows.map(w => w.id)).toEqual(['wf-1'])

    // The stale first response resolves late — must be ignored (alive guard).
    resolveFirst({ data: { data: [{ id: 'stale-wf', name: 'Stale', status: 'active', steps: [] }] } })
    await Promise.resolve()
    expect(result.current.workflows.map(w => w.id)).toEqual(['wf-1'])
  })

  it('does not setState after unmount', async () => {
    let resolveGet!: (v: unknown) => void
    const pending = new Promise(res => { resolveGet = res })
    mockedGet.mockImplementation((url: string) => (url === '/workflows' ? pending : Promise.resolve({ data: { data: [] } })))

    const { unmount } = renderHook(() => useWorkflowsData(false))
    unmount()

    // Resolving after unmount must not throw an act()/setState-after-unmount warning.
    await act(async () => {
      resolveGet({ data: { data: [{ id: 'wf-1', name: 'Welcome flow', status: 'active', steps: [] }] } })
      await Promise.resolve()
    })
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

// AIK-02 (contract audit 09-09): the list-row switch and the folder drag send a
// PARTIAL PUT — the old full payload was rebuilt from the list row and re-tagged an
// event workflow as a daily 09:00 schedule on every flip.
describe('useWorkflowsData · list mutations are partial PUTs (AIK-02)', () => {
  it('handleToggleStatus PUTs only status + active', async () => {
    seedList()
    mockedPut.mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.handleToggleStatus(result.current.workflows[0]) })

    await waitFor(() => expect(mockedPut).toHaveBeenCalledWith('/workflows/wf-1', { status: 'inactive', active: false }))
  })

  it('moveToFolder PUTs only folder_id', async () => {
    seedList()
    mockedPut.mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.moveToFolder('wf-1', 'f1') })

    await waitFor(() => expect(mockedPut).toHaveBeenCalledWith('/workflows/wf-1', { folder_id: 'f1' }))
  })

  // AIK-05: the backend's precise 422 reason reaches the planner, not one anonymous toast.
  it('handleToggleStatus surfaces the server reason on a 422', async () => {
    seedList()
    mockedPut.mockRejectedValue({ response: { status: 422, data: { message: 'Geen geldige vertrekmodule.' } } })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.handleToggleStatus(result.current.workflows[0]) })

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('Geen geldige vertrekmodule.'))
  })
})
