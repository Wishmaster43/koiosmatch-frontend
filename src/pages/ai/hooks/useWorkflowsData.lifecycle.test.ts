/** useWorkflowsData · archive, restore, list fetch and load-effect alive guard (split from useWorkflowsData.test.ts; folder, save and partial-PUT tests stay there). */
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
