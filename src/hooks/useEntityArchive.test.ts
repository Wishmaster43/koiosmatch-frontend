/**
 * useEntityArchive — asserts the REQUEST (§13): DELETE /{resource}/{id} on
 * confirm, POST /{resource}/{id}/restore on restore; a per-entity
 * mapArchiveError wins over the generic failure toast; and the confirm-cancel
 * path (the user never clicks through the staged confirmation) sends nothing.
 * useConfirm is mocked to CAPTURE the staged (message, onConfirm) pair instead
 * of rendering the real dialog — invoking the captured onConfirm simulates a
 * click on Confirm, never invoking it simulates Cancel/dismiss.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEntityArchive } from './useEntityArchive'
import api from '@/lib/api'
import { notify } from '@/lib/notify'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { delete: vi.fn(), post: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notify: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

let lastConfirm: { message: string; onConfirm: () => void } | null = null
vi.mock('@/hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: (message: string, onConfirm: () => void) => { lastConfirm = { message, onConfirm } },
    dialog: null,
  }),
}))

const mockDelete = api.delete as unknown as ReturnType<typeof vi.fn>
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

beforeEach(() => { vi.clearAllMocks(); lastConfirm = null })

describe('useEntityArchive · archive', () => {
  it('DELETEs /{resource}/{id} once the staged confirmation is confirmed, patches + reloads + toasts success', async () => {
    mockDelete.mockResolvedValue({})
    const onPatch = vi.fn()
    const onReload = vi.fn()
    const { result } = renderHook(() => useEntityArchive({ resource: 'matches', namespace: 'matches', onPatch, onReload }))

    act(() => { result.current.archive('m1') })
    expect(mockDelete).not.toHaveBeenCalled() // staged, not yet confirmed
    expect(lastConfirm).not.toBeNull()

    await act(async () => { await lastConfirm!.onConfirm() })

    expect(mockDelete).toHaveBeenCalledWith('/matches/m1')
    expect(onPatch).toHaveBeenCalledWith('m1', { archived: true, archivedAt: expect.any(String) })
    expect(onReload).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith('success', 'drawer.archived')
  })

  it('sends nothing when the user cancels/dismisses the confirmation', () => {
    const onPatch = vi.fn()
    const onReload = vi.fn()
    const { result } = renderHook(() => useEntityArchive({ resource: 'matches', namespace: 'matches', onPatch, onReload }))

    act(() => { result.current.archive('m1') })
    // The confirmation was staged but its onConfirm is never invoked (Cancel).
    expect(mockDelete).not.toHaveBeenCalled()
    expect(onPatch).not.toHaveBeenCalled()
    expect(onReload).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })

  it('lets a per-entity mapArchiveError win over the generic failure toast', async () => {
    mockDelete.mockRejectedValue({ response: { status: 409, data: { code: 'active_contract' } } })
    const mapArchiveError = vi.fn(() => 'Active contract, cannot archive')
    const { result } = renderHook(() => useEntityArchive({
      resource: 'matches', namespace: 'matches', onPatch: vi.fn(), onReload: vi.fn(), mapArchiveError,
    }))

    act(() => { result.current.archive('m1') })
    await act(async () => { await lastConfirm!.onConfirm() })

    expect(mapArchiveError).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('error', 'Active contract, cannot archive')
  })

  it('falls back to the generic failure toast when mapArchiveError returns null/is absent', async () => {
    mockDelete.mockRejectedValue({ response: { status: 500 } })
    const { result } = renderHook(() => useEntityArchive({ resource: 'matches', namespace: 'matches', onPatch: vi.fn(), onReload: vi.fn() }))

    act(() => { result.current.archive('m1') })
    await act(async () => { await lastConfirm!.onConfirm() })

    expect(notify).toHaveBeenCalledWith('error', 'drawer.archiveFailed')
  })
})

describe('useEntityArchive · restore', () => {
  it('POSTs /{resource}/{id}/restore, patches + reloads + toasts success', async () => {
    mockPost.mockResolvedValue({})
    const onPatch = vi.fn()
    const onReload = vi.fn()
    const { result } = renderHook(() => useEntityArchive({ resource: 'matches', namespace: 'matches', onPatch, onReload }))

    await act(async () => { await result.current.restore('m1') })

    expect(mockPost).toHaveBeenCalledWith('/matches/m1/restore')
    expect(onPatch).toHaveBeenCalledWith('m1', { archived: false, archivedAt: null })
    expect(onReload).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith('success', 'drawer.archivedBanner.restored')
  })

  it('toasts the generic restore-failed message on a rejected POST', async () => {
    mockPost.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useEntityArchive({ resource: 'matches', namespace: 'matches', onPatch: vi.fn(), onReload: vi.fn() }))

    await act(async () => { await result.current.restore('m1') })

    expect(notify).toHaveBeenCalledWith('error', 'drawer.archivedBanner.restoreFailed')
  })
})
