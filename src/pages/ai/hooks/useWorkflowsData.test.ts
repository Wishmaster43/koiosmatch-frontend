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
