/**
 * useWorkflowsData — regression tests for re-audit findings that moved along with
 * the WorkflowsPage extraction: createFolder/moveToFolder used to fail SILENTLY
 * (unlike the sibling handleToggleStatus rollback, which toasts), and handleSave
 * used to interpolate the RAW axios/network message into the user-facing alert
 * instead of routing it through the shared extractApiError helper (§10 — never
 * leak a raw server/axios string to the UI). `unwrap`/`unwrapList` stay the real
 * (pure) implementations; only the axios-like client is mocked.
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
// alert(t('page.saveFailed', { msg })) stays inspectable in the assertions below.
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
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    mockedPut.mockRejectedValue(new Error('Request failed with status code 500'))
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleSave({ id: 'wf-1', name: 'Welcome flow', status: 'active', steps: [{ id: 's1', type: 'email_send' }] })
    })

    // The raw axios message ("Request failed with status code 500") must never reach the user.
    expect(alertSpy).toHaveBeenCalledWith('page.saveFailed::common:actionFailed')
    alertSpy.mockRestore()
  })

  it('still surfaces the specific 422 validation detail (WF-R2 functional flow preserved)', async () => {
    seedList()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    mockedPut.mockRejectedValue({ response: { data: { message: 'The given data was invalid.', errors: { steps: ['Step 2 has no connection.'] } } } })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleSave({ id: 'wf-1', name: 'Welcome flow', status: 'active', steps: [{ id: 's1', type: 'email_send' }] })
    })

    expect(alertSpy).toHaveBeenCalledWith('page.saveFailed::Step 2 has no connection.')
    alertSpy.mockRestore()
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

    expect(mockedPost).toHaveBeenCalledWith('/workflows/wf-1/restore')
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
      { quietStatuses: [409], baseURL: expect.any(String) },
    )
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
      { quietStatuses: [409], baseURL: expect.any(String) },
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
      { quietStatuses: [409], baseURL: expect.any(String) },
    )
    await waitFor(() => expect(mockedPost).toHaveBeenNthCalledWith(
      2, '/workflows/wf-1/run-bulk', { confirm: true },
      { quietStatuses: [409], baseURL: expect.any(String) },
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
