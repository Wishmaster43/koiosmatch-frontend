/**
 * useInlineContactCreate — ONIX N-007 regression: two synchronous `saveContact`
 * calls (two Save-button clicks before the first POST settles) must POST
 * /customers/{id}/contacts exactly once. The guard is useGuardedSubmit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInlineContactCreate } from './useInlineContactCreate'

vi.mock('@/lib/api', () => ({
  default: { post: vi.fn() },
  unwrap: (r: { data?: unknown }) => r?.data,
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

beforeEach(async () => {
  const api = (await import('@/lib/api')).default
  vi.mocked(api.post).mockReset()
})

describe('useInlineContactCreate', () => {
  it('two synchronous saveContact() calls POST /customers/{id}/contacts once', async () => {
    const api = (await import('@/lib/api')).default
    // Never resolves within this test — proves the second call is dropped
    // while the first POST is still in flight.
    vi.mocked(api.post).mockReturnValueOnce(new Promise(() => {}))
    const { result } = renderHook(() => useInlineContactCreate({
      customerId: 'cust-1', locationId: '', contacts: [],
      refetchCustomer: vi.fn(() => Promise.resolve()), setContactId: vi.fn(),
    }))

    act(() => { result.current.setNc({ first_name: 'Piet', last_name: 'Kandidaat', email: '', phone: '', mobile: '', function: '' }) })

    await act(async () => {
      void result.current.saveContact()
      void result.current.saveContact()
    })

    // §13: the request itself, not only that a callback fired.
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith('/customers/cust-1/contacts', expect.objectContaining({ first_name: 'Piet', last_name: 'Kandidaat' }))
  })
})
