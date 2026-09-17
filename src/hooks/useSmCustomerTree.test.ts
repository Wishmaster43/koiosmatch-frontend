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

vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }))

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
})
