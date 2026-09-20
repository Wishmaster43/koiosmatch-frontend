/**
 * useArchivedCustomerLocations — a failed GET must surface as `error`, never as
 * a silent empty list (§3 four UI states). Regression for the swallowed `.catch`
 * that returned no error field at all (mirrors useCustomerContacts/
 * useCustomerDepartments's live-list error tracking).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useArchivedCustomerLocations } from './useCustomerLocations'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn() },
  unwrapList: (r: { data: { data: unknown[] } }) => ({ rows: r.data.data }),
}))

afterEach(() => { vi.mocked(api.get).mockReset() })

describe('useArchivedCustomerLocations · error state', () => {
  it('sets error true when the archived GET rejects, instead of just showing an empty list', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useArchivedCustomerLocations('cust-1', true))
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.locations).toEqual([])
  })

  it('clears error on a subsequent successful fetch', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    const { result } = renderHook(() => useArchivedCustomerLocations('cust-1', true))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(false)
  })
})
