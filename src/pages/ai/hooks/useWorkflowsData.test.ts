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
// Minimal i18n stub that still interpolates {{msg}}-style options so handleSave's
// alert(t('page.saveFailed', { msg })) stays inspectable in the assertions below.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts?.msg ? `${key}::${opts.msg}` : key) }),
}))

import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
const mockedGet    = vi.mocked(api.get)
const mockedPost   = vi.mocked(api.post)
const mockedPut    = vi.mocked(api.put)

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
