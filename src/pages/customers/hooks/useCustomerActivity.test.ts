/**
 * useCustomerActivity — §3 four UI states: a real fetch failure must set `error`
 * (not silently degrade to an empty list looking identical to "nothing happened
 * yet"). Covers the success path, the abort-is-not-an-error path, and the real
 * failure path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCustomerActivity } from './useCustomerActivity'

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))
vi.mock('@/lib/api', () => ({
  default: { get: getMock },
  unwrapList: (res: { data: { data: unknown[] } }) => ({ rows: res.data.data, total: res.data.data.length, lastPage: 1 }),
}))
vi.mock('@/lib/abortError', () => ({ isAbortError: (e: unknown) => (e as { name?: string })?.name === 'AbortError' }))

describe('useCustomerActivity', () => {
  beforeEach(() => { getMock.mockReset() })

  it('loads the customer activity feed on mount and clears loading/error', async () => {
    getMock.mockResolvedValue({ data: { data: [{ id: '1' }] } })
    const { result } = renderHook(() => useCustomerActivity({ customerId: 'cust-1' }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(false)
    expect(result.current.items).toHaveLength(1)
    expect(getMock).toHaveBeenCalledWith('/customers/cust-1/activity', expect.any(Object))
  })

  it('uses the sub-entity endpoint when given, never the customer fallback route', async () => {
    getMock.mockResolvedValue({ data: { data: [] } })
    renderHook(() => useCustomerActivity({ customerId: 'cust-1', endpoint: '/customers/cust-1/locations/loc-1/activity' }))

    await waitFor(() => expect(getMock).toHaveBeenCalledWith('/customers/cust-1/locations/loc-1/activity', expect.any(Object)))
  })

  it('sets error and clears items on a real fetch failure — never the silent "nothing happened" degrade', async () => {
    getMock.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useCustomerActivity({ customerId: 'cust-1' }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(true)
    expect(result.current.items).toEqual([])
  })

  it('does not set error on an aborted request', async () => {
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' })
    getMock.mockRejectedValue(abortErr)
    const { result } = renderHook(() => useCustomerActivity({ customerId: 'cust-1' }))

    await waitFor(() => expect(getMock).toHaveBeenCalled())
    expect(result.current.error).toBe(false)
  })
})
