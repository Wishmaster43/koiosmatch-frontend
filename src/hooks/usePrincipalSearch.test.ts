// usePrincipalSearch — asserts the actual GET request shape (§13: assert the
// request, never only that a callback fired): no q/search on an empty query,
// q+search+per_page 25 once a query is typed, and no call at all when url is
// undefined (DRY round 11, NOTES2).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { usePrincipalSearch } from './usePrincipalSearch'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn() },
  unwrapList: (r: { data: unknown[] }) => ({ rows: r.data }),
}))

const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

describe('usePrincipalSearch', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockResolvedValue({ data: [] })
  })

  it('fetches with per_page only on an empty query — no q/search key at all', async () => {
    renderHook(() => usePrincipalSearch('/customers', ''))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/customers', { params: { per_page: 25 } }))
  })

  it('fetches with q+search+per_page once a query is given', async () => {
    renderHook(() => usePrincipalSearch('/customers', 'Acme'))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/customers', { params: { q: 'Acme', search: 'Acme', per_page: 25 } }))
  })

  it('sends no request and clears rows when url is undefined', async () => {
    const { result } = renderHook(() => usePrincipalSearch(undefined, ''))
    await waitFor(() => expect(result.current.rows).toEqual([]))
    expect(mockGet).not.toHaveBeenCalled()
  })
})
