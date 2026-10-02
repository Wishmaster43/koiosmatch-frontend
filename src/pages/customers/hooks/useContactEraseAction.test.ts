/**
 * useContactEraseAction — asserts the exact erase POST route/body (§13), the
 * CONTACTS_CHANGED_EVENT broadcast and the close() callback, extracted out of
 * ContactDetail per SHARED-UNIT-TEST-1.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { useContactEraseAction } from './useContactEraseAction'
import { CONTACTS_CHANGED_EVENT } from './useCustomerContacts'
import type { Contact } from '@/types/customer'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { ...(actual as { default: object }).default, post: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))

const contact = { id: 'c1', customerId: 'cust-1', name: 'Jane Doe' } as unknown as Contact

describe('useContactEraseAction', () => {
  afterEach(() => vi.clearAllMocks())

  it('starts closed and open()/cancel() toggle the dialog flag', () => {
    const { result } = renderHook(() => useContactEraseAction(contact, vi.fn(), 'done'))
    expect(result.current.erasing).toBe(false)
    act(() => result.current.open())
    expect(result.current.erasing).toBe(true)
    act(() => result.current.cancel())
    expect(result.current.erasing).toBe(false)
  })

  it('confirm() POSTs the erase route with { password }, broadcasts the refresh event and closes', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { message: 'ok', contact_id: 'c1' } } })
    const close = vi.fn()
    const onChangedEvent = vi.fn()
    window.addEventListener(CONTACTS_CHANGED_EVENT, onChangedEvent)
    const { result } = renderHook(() => useContactEraseAction(contact, close, 'done'))

    act(() => result.current.open())
    await act(async () => { await result.current.confirm('geheim') })

    expect(api.post).toHaveBeenCalledWith('/customers/cust-1/contacts/c1/erase', { password: 'geheim' })
    expect(onChangedEvent).toHaveBeenCalled()
    expect(result.current.erasing).toBe(false)
    expect(close).toHaveBeenCalled()
    window.removeEventListener(CONTACTS_CHANGED_EVENT, onChangedEvent)
  })

  it('confirm() does nothing without a linked customerId', async () => {
    const close = vi.fn()
    const { result } = renderHook(() => useContactEraseAction({ ...contact, customerId: undefined } as unknown as Contact, close, 'done'))

    await act(async () => { await result.current.confirm('geheim') })

    expect(api.post).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.erasing).toBe(false))
  })
})
