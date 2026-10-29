import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { useReportCustomers } from './useReportCustomers'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

describe('useReportCustomers', () => {
  it('reads every /sm_customers page through the shared fetch', async () => {
    const page = (n: number) => ({ data: { data: [{ id: `c${n}` }], meta: { current_page: n, last_page: 2, per_page: 200, total: 2 } } })
    vi.mocked(api.get).mockResolvedValueOnce(page(1) as never).mockResolvedValueOnce(page(2) as never)
    const { result } = renderHook(() => useReportCustomers())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(vi.mocked(api.get).mock.calls.map(c => [c[0], (c[1] as { params: unknown }).params])).toEqual([
      ['/sm_customers', { per_page: 200 }],
      ['/sm_customers', { per_page: 200, page: 2 }],
    ])
    expect(result.current.customers).toHaveLength(2)
  })
})
