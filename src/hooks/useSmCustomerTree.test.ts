/**
 * Regression test for the r1-hooks-b audit finding: a failed GET /sm_customers
 * used to be swallowed silently, so every consumer (Locations/Departments/
 * ContactPersons tables) rendered its translated empty-state copy exactly as
 * if the tenant genuinely had zero rows. This pins the honest error channel.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { useSmCustomerTree } from './useSmCustomerTree'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

describe('useSmCustomerTree', () => {
  it('reports success with the fetched rows and no error', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [{ id: 'c1' }] } } as never)
    const { result } = renderHook(() => useSmCustomerTree())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(false)
    expect(result.current.customers).toEqual([{ id: 'c1' }])
  })

  it('sets error=true on a failed fetch instead of silently reporting an empty tree', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('network'))
    const { result } = renderHook(() => useSmCustomerTree())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(true)
    expect(result.current.customers).toEqual([])
  })

  // N-010: every server page is read (the BE caps one page at 200), asserting the requests.
  it('requests all pages with per_page 200 and merges the rows', async () => {
    const page = (n: number) => ({ data: { data: [{ id: `c${n}` }], meta: { current_page: n, last_page: 3, per_page: 200, total: 3 } } })
    vi.mocked(api.get).mockReset()
    vi.mocked(api.get).mockResolvedValueOnce(page(1) as never).mockResolvedValueOnce(page(2) as never).mockResolvedValueOnce(page(3) as never)
    const { result } = renderHook(() => useSmCustomerTree())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const calls = vi.mocked(api.get).mock.calls
    expect(calls.map(c => [c[0], (c[1] as { params: unknown }).params])).toEqual([
      ['/sm_customers', { per_page: 200 }],
      ['/sm_customers', { per_page: 200, page: 2 }],
      ['/sm_customers', { per_page: 200, page: 3 }],
    ])
    expect(result.current.customers.map(c => c.id)).toEqual(['c1', 'c2', 'c3'])
    expect(result.current.truncated).toBe(false)
  })

  it('flags truncated when the page cap is hit', async () => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 'x' }], meta: { current_page: 1, last_page: 25, per_page: 200, total: 5000 } } } as never)
    const { result } = renderHook(() => useSmCustomerTree())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(vi.mocked(api.get)).toHaveBeenCalledTimes(20)
    expect(result.current.truncated).toBe(true)
  })
})
