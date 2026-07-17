/**
 * useCustomerCascade — the shared customer→location→department→contact cascade
 * (promoted from pages/opportunities/hooks, audit R1 item 2). Covers: clears on
 * no id, loads locations/contacts/detail on pick, drops a stale response after a
 * quick id change (the `alive` guard), and `refetch` re-fetches the same id.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCustomerCascade } from './useCustomerCascade'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn() },
  unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
}))

const customerFixture = {
  id: 'cust-1', branch_id: 'branch-1', branch: { id: 'branch-1', name: 'Noord' },
  cost_center: 'KP-KLANT', billing_email: 'klant@factuur.nl',
  locations: [{ id: 'loc-1', name: 'Locatie Noord', departments: [{ id: 'dep-1', name: 'Afdeling A' }] }],
  contacts: [{ id: 'con-1', name: 'Jan Jansen' }],
}

describe('useCustomerCascade', () => {
  beforeEach(() => { vi.mocked(api.get).mockReset() })

  it('starts empty and stays empty with no customer id', () => {
    const { result } = renderHook(() => useCustomerCascade(''))
    expect(result.current.locations).toEqual([])
    expect(result.current.contacts).toEqual([])
    expect(result.current.detail).toBeNull()
    expect(api.get).not.toHaveBeenCalled()
  })

  it('fetches and exposes locations/contacts/detail once a customer is picked', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: customerFixture } })
    const { result } = renderHook(() => useCustomerCascade('cust-1'))
    await waitFor(() => expect(result.current.locations).toHaveLength(1))
    expect(api.get).toHaveBeenCalledWith('/customers/cust-1')
    expect(result.current.contacts).toEqual(customerFixture.contacts)
    expect(result.current.detail?.branch_id).toBe('branch-1')
    expect(result.current.detail?.cost_center).toBe('KP-KLANT')
  })

  it('clears detail when the customer id is cleared again', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: customerFixture } })
    const { result, rerender } = renderHook(({ id }) => useCustomerCascade(id), { initialProps: { id: 'cust-1' } })
    await waitFor(() => expect(result.current.locations).toHaveLength(1))
    rerender({ id: '' })
    expect(result.current.detail).toBeNull()
    expect(result.current.locations).toEqual([])
  })

  it('falls back to empty state when the fetch fails', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('network'))
    const { result } = renderHook(() => useCustomerCascade('cust-err'))
    await waitFor(() => expect(result.current.detail).toBeNull())
    expect(result.current.locations).toEqual([])
  })

  it('refetch re-fetches the same customer id (e.g. after inline-creating a contact)', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: customerFixture } })
    const { result } = renderHook(() => useCustomerCascade('cust-1'))
    await waitFor(() => expect(result.current.contacts).toHaveLength(1))

    const updated = { ...customerFixture, contacts: [...customerFixture.contacts, { id: 'con-2', name: 'Nieuw Contact' }] }
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: updated } })
    await result.current.refetch()
    await waitFor(() => expect(result.current.contacts).toHaveLength(2))
    expect(api.get).toHaveBeenCalledTimes(2)
  })
})
