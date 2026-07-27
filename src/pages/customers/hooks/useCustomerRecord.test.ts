/**
 * useCustomerRecord — regression coverage for the optimistic-update bug class
 * (measured audit 2026-07-27): selectCustomer's detail GET had a completely EMPTY
 * catch (the worst variant — the drawer sat on the light row forever with NO signal
 * a load failed) and updateCustomer's PATCH reverted nothing on failure, leaving a
 * rejected value on screen in every slice as if the server had saved it. Assert the
 * SEAM (§13): the exact request, the optimistic write, and that a rejection restores
 * ONLY the patched field(s) in every touched slice (list row, selected, detail)
 * without clobbering an unrelated field.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { useCustomerRecord } from './useCustomerRecord'
import type { Customer } from '@/types/customer'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

import api from '@/lib/api'
import { notifyError } from '@/lib/notify'

const mockedGet   = vi.mocked(api.get)
const mockedPatch = vi.mocked(api.patch)
const t = ((k: string) => k) as unknown as import('i18next').TFunction

beforeEach(() => vi.clearAllMocks())

// Minimal Customer fixture — only the fields the mutations under test read/write.
const customer = (overrides: Partial<Customer> = {}): Customer => ({
  id: 1, name: 'Test customer', initials: 'TC', debtorNumber: '', status: 'prospect',
  statusLabel: 'Prospect', statusColor: 'slate', owner: '', ownerId: null, ownerInitials: '', ownerColor: null,
  city: '', lat: null, lng: null, distanceKm: null, industry: '', website: '', employeeCount: '',
  toneOfVoice: '', description: '', recruitmentProblems: '', privacyPolicyUrl: '',
  hideCompanyName: false, hasCareerPage: false, showInVacancies: false, excludeFromSourcing: false,
  costCenter: '', billingEmail: '', tags: [], archived: false, locations: [], departments: [], contacts: [],
  notes: [], locationsCount: 0, departmentsCount: 0, contactsCount: 0, openVacanciesCount: 0,
  activeMatchesCount: 0, created: '', logo: null, koiosAdvice: null, customFields: {},
  ...overrides,
} as Customer)

// Harness with real state so the optimistic write → revert-on-failure is observable
// (mirrors useApplicationDrawerActions.test.ts's harness).
function harness(initial: Customer[]) {
  return renderHook(() => {
    const [customers, setCustomers] = useState<Customer[]>(initial)
    const [total, setTotal] = useState(initial.length)
    const record = useCustomerRecord({ setCustomers, setTotal, users: [], t })
    return { customers, total, record }
  })
}

describe('useCustomerRecord · selectCustomer error signalling', () => {
  it('notifies the user when the detail fetch fails (was a fully silent catch)', async () => {
    mockedGet.mockRejectedValue({ response: { status: 500 } })
    const r = harness([customer({ id: 1 })])
    act(() => { r.result.current.record.selectCustomer(customer({ id: 1 })) })
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('common:actionFailed'))
    // The light row still shows — no silent blank drawer.
    expect(r.result.current.record.selected?.id).toBe(1)
  })

  it('does not notify once a different customer has since been opened', async () => {
    // Each api.get call gets its own reject callback, indexed by call order.
    const rejectors: Array<(err: unknown) => void> = []
    mockedGet.mockImplementation(() => new Promise((_, rej) => { rejectors.push(rej) }))
    const r = harness([customer({ id: 1 }), customer({ id: 2 })])
    act(() => { r.result.current.record.selectCustomer(customer({ id: 1 })) })
    // The user moves on to a second customer before the first (now-stale) fetch settles.
    act(() => { r.result.current.record.selectCustomer(customer({ id: 2 })) })
    act(() => { rejectors[0]({ response: { status: 500 } }) })
    await new Promise(res => setTimeout(res, 0))
    expect(notifyError).not.toHaveBeenCalled()
  })
})

describe('useCustomerRecord · updateCustomer', () => {
  it('PATCHes the mapped body and keeps the new value when the server accepts', async () => {
    mockedPatch.mockResolvedValue({})
    const r = harness([customer({ id: 1, name: 'Old name' })])
    act(() => { r.result.current.record.updateCustomer(1, { name: 'New name' }) })
    expect(mockedPatch).toHaveBeenCalledWith('/customers/1', { name: 'New name' })
    await waitFor(() => expect(r.result.current.customers[0].name).toBe('New name'))
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('reverts ONLY the patched field on the list row and reports the server message on failure', async () => {
    mockedPatch.mockRejectedValue({ response: { status: 422, data: { message: 'Naam is verplicht' } } })
    const r = harness([customer({ id: 1, name: 'Old name', city: 'Utrecht' })])
    act(() => { r.result.current.record.updateCustomer(1, { name: '' }) })
    expect(r.result.current.customers[0].name).toBe('') // optimistic
    await waitFor(() => expect(r.result.current.customers[0].name).toBe('Old name')) // reverted
    expect(r.result.current.customers[0].city).toBe('Utrecht') // untouched field survives
    expect(notifyError).toHaveBeenCalledWith('Naam is verplicht')
  })

  it('reverts the open drawer (selected + detail) alongside the list row on failure', async () => {
    mockedGet.mockResolvedValue({ data: { id: 1, name: 'Old name' } })
    const r = harness([customer({ id: 1, name: 'Old name' })])
    act(() => { r.result.current.record.selectCustomer(customer({ id: 1, name: 'Old name' })) })
    await waitFor(() => expect(r.result.current.record.detail?.id).toBe(1))

    mockedPatch.mockRejectedValue({ response: { status: 500 } })
    act(() => { r.result.current.record.updateCustomer(1, { name: 'Rejected name' }) })
    expect(r.result.current.record.selected?.name).toBe('Rejected name') // optimistic
    expect(r.result.current.record.detail?.name).toBe('Rejected name')   // optimistic
    await waitFor(() => expect(r.result.current.record.selected?.name).toBe('Old name'))
    expect(r.result.current.record.detail?.name).toBe('Old name')
    expect(notifyError).toHaveBeenCalledWith('common:actionFailed')
  })

  it('is a no-op PATCH when the patch maps to no known field', () => {
    const r = harness([customer({ id: 1 })])
    act(() => { r.result.current.record.updateCustomer(1, { unknownField: 'x' }) })
    expect(mockedPatch).not.toHaveBeenCalled()
  })
})
