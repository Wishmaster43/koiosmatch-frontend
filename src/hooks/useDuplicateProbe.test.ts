import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useDuplicateProbe, useRestoreArchivedDuplicate } from './useDuplicateProbe'
import { queryClient } from '@/lib/queryClient'
import { notifyError, notifySuccess } from '@/lib/notify'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { ...actual.default, post: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const KEYS = ['email', 'mobile', 'phone'] as const

// Asserts the exact request the shared probe sends: POST body, never query params.
describe('useDuplicateProbe', () => {
  it('posts the mapped body to the given path once debounced', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.post).mockResolvedValue({ data: { exists: true, match: { id: '1' } } })
    const { result } = renderHook(() => useDuplicateProbe('/candidates/check-duplicate', KEYS, 'a@b.com', '', ''))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      '/candidates/check-duplicate',
      { email: 'a@b.com', mobile: undefined, phone: undefined },
      expect.objectContaining({ signal: expect.anything() }),
    ))
    await waitFor(() => expect(result.current.probeMatch).toEqual({ id: '1' }))
  })

  it('does not probe when all three fields are empty', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.post).mockClear()
    renderHook(() => useDuplicateProbe('/candidates/check-duplicate', KEYS, '', '', ''))
    await new Promise(r => setTimeout(r, 20))
    expect(api.post).not.toHaveBeenCalled()
  })
})

// useRestoreArchivedDuplicate — shared by useRestoreDuplicate (candidates) and
// useRestoreCustomerDuplicate (customers): asserts the exact per-id restore
// request, the cache invalidation and the 403-vs-other message branching.
describe('useRestoreArchivedDuplicate', () => {
  afterEach(() => { vi.clearAllMocks() })

  const messages = { restored: 'Hersteld', restoreForbidden: 'Geen rechten', restoreFailed: 'Mislukt' }

  it('POSTs the per-id restore route for the given entity and invalidates its list cache', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useRestoreArchivedDuplicate({ entity: 'candidates', messages }))

    let ok: boolean | undefined
    await act(async () => { ok = await result.current.restore('c1') })

    expect(api.post).toHaveBeenCalledWith('/candidates/c1/restore')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['candidates'] })
    expect(notifySuccess).toHaveBeenCalledWith('Hersteld')
    expect(ok).toBe(true)
  })

  it('uses the customers route/cache key for the customers entity', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useRestoreArchivedDuplicate({ entity: 'customers', messages }))

    await act(async () => { await result.current.restore('k9') })

    expect(api.post).toHaveBeenCalledWith('/customers/k9/restore')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['customers'] })
  })

  it('shows the forbidden message on a 403 and returns false', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.post).mockRejectedValue({ response: { status: 403 } })
    const { result } = renderHook(() => useRestoreArchivedDuplicate({ entity: 'candidates', messages }))

    let ok: boolean | undefined
    await act(async () => { ok = await result.current.restore('c1') })

    expect(notifyError).toHaveBeenCalledWith('Geen rechten')
    expect(ok).toBe(false)
  })

  it('shows the generic failure message on any other error', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.post).mockRejectedValue({ response: { status: 500 } })
    const { result } = renderHook(() => useRestoreArchivedDuplicate({ entity: 'candidates', messages }))

    await act(async () => { await result.current.restore('c1') })

    expect(notifyError).toHaveBeenCalledWith('Mislukt')
  })
})
