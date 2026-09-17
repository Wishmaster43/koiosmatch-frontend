import { describe, it, expect, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useSubEntityDuplicateGuard } from './useSubEntityDuplicateGuard'

// The restore affordance is gated on customers.update (ADOPT-A2 verify point); the
// tests flip the permission per case.
const mockHasPermission = vi.fn((perm: string) => perm === 'customers.update')
vi.mock('@/hooks/useSafePermission', () => ({ useSafePermission: () => (perm: string) => mockHasPermission(perm) }))

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { ...actual.default, post: vi.fn() } }
})

const KEYS = ['name', 'coc_number', 'email'] as const

// Asserts the exact per-customer scoped route (DUP-STAMDATA-1, ADOPT-A2 row 81)
// and that a picked-up match reaches onOpenExisting.
describe('useSubEntityDuplicateGuard', () => {
  it('POSTs to /customers/{customerId}/{entity}/check-duplicate with the mapped body', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.post).mockResolvedValue({ data: { exists: true, match: { id: 'loc-1', name: 'Acme HQ' } } })

    const { result } = renderHook(() => useSubEntityDuplicateGuard('locations', 'cust-1', KEYS, 'Acme HQ', '', ''))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      '/customers/cust-1/locations/check-duplicate',
      { name: 'Acme HQ', coc_number: undefined, email: undefined },
      expect.objectContaining({ signal: expect.anything() }),
    ))
    await waitFor(() => expect(result.current.notice).toEqual({ id: 'loc-1', name: 'Acme HQ' }))
  })

  it('never probes without a customerId', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.post).mockClear()
    renderHook(() => useSubEntityDuplicateGuard('departments', undefined, KEYS, 'Sales', '', ''))
    await new Promise(r => setTimeout(r, 20))
    expect(api.post).not.toHaveBeenCalled()
  })

  it('openExisting calls the onOpenExisting callback with the match id and its archived flag', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.post).mockResolvedValue({ data: { exists: true, match: { id: 'c-9', name: 'Jane', archived: true } } })
    const onOpenExisting = vi.fn()
    const { result } = renderHook(() => useSubEntityDuplicateGuard('contacts', 'cust-1', KEYS, 'Jane', '', '', onOpenExisting))
    await waitFor(() => expect(result.current.notice).not.toBeNull())
    result.current.openExisting('c-9')
    // ADOPT-A2-VERIFY-FIX: archived is threaded through so the caller can flip its
    // own quick-view before opening — otherwise an archived hit's row isn't loaded.
    expect(onOpenExisting).toHaveBeenCalledWith('c-9', true)
  })

  it('restore POSTs to the per-id restore route and opens the record on success', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    const onOpenExisting = vi.fn()
    const { result } = renderHook(() => useSubEntityDuplicateGuard('locations', 'cust-1', KEYS, '', '', '', onOpenExisting))

    await act(async () => { await result.current.restore('loc-9') })

    expect(api.post).toHaveBeenCalledWith('/customers/cust-1/locations/loc-9/restore')
    expect(onOpenExisting).toHaveBeenCalledWith('loc-9', false)
  })

  it('restore announces the entity list-change event before opening the record', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    const seen: string[] = []
    const onEvent = () => seen.push('event')
    const onOpenExisting = vi.fn(() => seen.push('open'))
    window.addEventListener('km:departments-changed', onEvent)
    const { result } = renderHook(() => useSubEntityDuplicateGuard('departments', 'cust-1', KEYS, '', '', '', onOpenExisting))

    await act(async () => { await result.current.restore('d-3') })

    window.removeEventListener('km:departments-changed', onEvent)
    // The list refetches on its change event only, so the announcement precedes the open.
    expect(seen).toEqual(['event', 'open'])
  })

  it('canRestore requires an archived match AND customers.update', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.post).mockResolvedValue({ data: { exists: true, match: { id: 'c-9', name: 'Jane', archived: true } } })
    mockHasPermission.mockImplementation(() => false)
    const { result } = renderHook(() => useSubEntityDuplicateGuard('contacts', 'cust-1', KEYS, 'Jane', '', ''))
    await waitFor(() => expect(result.current.notice).not.toBeNull())
    expect(result.current.canRestore).toBe(false)

    mockHasPermission.mockImplementation((perm: string) => perm === 'customers.update')
    const { result: allowed } = renderHook(() => useSubEntityDuplicateGuard('contacts', 'cust-1', KEYS, 'Jane', '', ''))
    await waitFor(() => expect(allowed.current.notice).not.toBeNull())
    expect(allowed.current.canRestore).toBe(true)
  })

  it('restore reports a failure via the caller-provided messages and never opens the record', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.post).mockRejectedValue({ response: { status: 500 } })
    const onOpenExisting = vi.fn()
    const messages = { restoreFailed: 'Restore failed.', restoreForbidden: 'Not allowed.' }
    const { result } = renderHook(() => useSubEntityDuplicateGuard('locations', 'cust-1', KEYS, '', '', '', onOpenExisting, messages))

    await act(async () => { await result.current.restore('loc-9') })

    expect(onOpenExisting).not.toHaveBeenCalled()
    expect(result.current.restoring).toBe(false)
  })

  it('dismiss clears the notice and clearOnEdit re-arms it', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.post).mockResolvedValue({ data: { exists: true, match: { id: 'd-1', name: 'Sales' } } })
    const { result, rerender } = renderHook(
      ({ a }) => useSubEntityDuplicateGuard('departments', 'cust-1', KEYS, a, '', ''),
      { initialProps: { a: 'Sales' } },
    )
    await waitFor(() => expect(result.current.notice).toEqual({ id: 'd-1', name: 'Sales' }))

    act(() => result.current.dismiss())
    expect(result.current.notice).toBeNull()

    act(() => result.current.clearOnEdit())
    rerender({ a: 'Sales2' })
    await waitFor(() => expect(result.current.notice).not.toBeNull())
  })
})
