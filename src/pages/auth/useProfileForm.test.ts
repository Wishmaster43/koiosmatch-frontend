/**
 * useProfileForm — regression test for the avatar-upload blob: URL lifecycle.
 * Picking a file creates an object URL for the instant preview; a second pick,
 * a successful upload (server avatar replaces it) or unmount must revoke the
 * previous one — otherwise every avatar pick leaks memory for the tab's
 * lifetime (mirrors EntityHeader's PhotoAvatar fix).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor, cleanup } from '@testing-library/react'
import { useProfileForm } from './useProfileForm'
import api from '@/lib/api'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', firstname: 'Jane', lastname: 'Doe', email: 'jane@x.nl', phone: '' }, refreshUser: vi.fn() }),
}))
vi.mock('@/lib/api', () => ({ default: { put: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

// jsdom has no real blob: URL support — stub with predictable, distinguishable values.
let urlSeq = 0
const createObjectURL = vi.fn(() => `blob:mock-${++urlSeq}`)
const revokeObjectURL = vi.fn()

beforeEach(() => {
  urlSeq = 0
  vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
})
afterEach(() => {
  // Unmount WHILE the stub is still active — otherwise the unmount-time revoke effect
  // (RTL's own auto-cleanup) runs after globals are restored and throws on the real URL.
  cleanup()
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const file = (name: string) => new File(['x'], name, { type: 'image/png' })
// e.target.files is read-only in the DOM — build the minimal ChangeEvent shape the hook reads.
const pickEvent = (f: File) => ({ target: { files: [f], value: '' } }) as unknown as Parameters<ReturnType<typeof useProfileForm>['onPickAvatar']>[0]

describe('useProfileForm avatar blob URL lifecycle', () => {
  it('revokes the previous object URL when a second photo is picked before upload resolves', () => {
    vi.mocked(api.post).mockReturnValue(new Promise(() => {})) // never resolves — stay in the "picking" state
    const { result } = renderHook(() => useProfileForm())

    // Fire-and-forget: onPickAvatar runs synchronously up to its first `await`
    // (the pending api.post), which is exactly the state under test.
    act(() => { void result.current.onPickAvatar(pickEvent(file('a.png'))) })
    expect(result.current.photo).toBe('blob:mock-1')
    expect(revokeObjectURL).not.toHaveBeenCalled()

    act(() => { void result.current.onPickAvatar(pickEvent(file('b.png'))) })
    expect(result.current.photo).toBe('blob:mock-2')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-1')
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it('revokes the local preview once the server avatar_url replaces it', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { avatar_url: 'https://cdn/x.png' } })
    const { result } = renderHook(() => useProfileForm())

    await act(async () => { await result.current.onPickAvatar(pickEvent(file('a.png'))) })
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-1'))
  })

  it('keeps the local preview (no revoke) when the upload fails', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('500'))
    const { result } = renderHook(() => useProfileForm())

    await act(async () => { await result.current.onPickAvatar(pickEvent(file('a.png'))) })
    expect(result.current.photo).toBe('blob:mock-1')
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it('revokes the tracked object URL on unmount', () => {
    vi.mocked(api.post).mockReturnValue(new Promise(() => {}))
    const { result, unmount } = renderHook(() => useProfileForm())
    act(() => { void result.current.onPickAvatar(pickEvent(file('a.png'))) })
    unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-1')
  })

  it('revokes on removeAvatar', async () => {
    vi.mocked(api.post).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.delete).mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useProfileForm())
    act(() => { void result.current.onPickAvatar(pickEvent(file('a.png'))) })
    await act(async () => { await result.current.removeAvatar() })
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-1')
  })
})
