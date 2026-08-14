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
  return { ...actual, default: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() } }
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
  city: '', email: '', phone: '', lat: null, lng: null, distanceKm: null, industry: '', website: '', employeeCount: '',
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

  // JOB-CONTACT-1 (Danny 28-07): the customer's own e-mail/phone Contact card —
  // FIELD_MAP must send the exact API keys, not silently drop them.
  it('maps email/phone to their API keys', async () => {
    mockedPatch.mockResolvedValue({})
    const r = harness([customer({ id: 1, email: 'old@rivas.nl', phone: '010-000' })])
    act(() => { r.result.current.record.updateCustomer(1, { email: 'new@rivas.nl', phone: '010-111' }) })
    expect(mockedPatch).toHaveBeenCalledWith('/customers/1', { email: 'new@rivas.nl', phone: '010-111' })
    await waitFor(() => expect(r.result.current.customers[0].email).toBe('new@rivas.nl'))
    expect(r.result.current.customers[0].phone).toBe('010-111')
  })

  // FACTUURADRES-1 (Danny 2026-08-01): the invoice-address block. A key MISSING from
  // FIELD_MAP is silently dropped before the request is built, so the assertion is on
  // the exact PATCH body — the seam, not the callback.
  it('maps the invoice address to its billing_* API keys', async () => {
    mockedPatch.mockResolvedValue({})
    const r = harness([customer({ id: 1 })])
    act(() => {
      r.result.current.record.updateCustomer(1, {
        billingPoBox: 'Postbus 1234', billingStreet: 'Keizersgracht', billingHouseNumber: '7',
        billingHouseNumberSuffix: 'B', billingPostalCode: '1015 CJ', billingCity: 'Amsterdam',
        billingCountry: 'NL',
      })
    })
    expect(mockedPatch).toHaveBeenCalledWith('/customers/1', {
      billing_po_box: 'Postbus 1234', billing_street: 'Keizersgracht', billing_house_number: '7',
      billing_house_number_suffix: 'B', billing_postcode: '1015 CJ', billing_city: 'Amsterdam',
      billing_country: 'NL',
    })
    await waitFor(() => expect((r.result.current.customers[0] as unknown as Record<string, unknown>).billingCity).toBe('Amsterdam'))
  })

  // Clearing the block is what makes it fall back to the visit address again, so the
  // empty strings must actually travel instead of being dropped as "nothing changed".
  it('sends explicit empty strings when the invoice address is cleared (empty = use the visit address)', () => {
    mockedPatch.mockResolvedValue({})
    const r = harness([customer({ id: 1 })])
    act(() => { r.result.current.record.updateCustomer(1, { billingPoBox: '', billingCity: '' }) })
    expect(mockedPatch).toHaveBeenCalledWith('/customers/1', { billing_po_box: '', billing_city: '' })
  })
})

describe('useCustomerRecord · invoice-address block on the fetched detail', () => {
  it('folds the billing_* columns onto the detail record so the Facturatie tab can read them', async () => {
    mockedGet.mockResolvedValue({ data: { id: 1, name: 'Rivas', billing_po_box: 'Postbus 1234', billing_city: 'Gorinchem' } })
    const r = harness([customer({ id: 1 })])
    act(() => { r.result.current.record.selectCustomer(customer({ id: 1 })) })
    await waitFor(() => expect(r.result.current.record.detail?.id).toBe(1))
    const detail = r.result.current.record.detail as unknown as Record<string, unknown>
    expect(detail.billingPoBox).toBe('Postbus 1234')
    expect(detail.billingCity).toBe('Gorinchem')
    // A column the response does not carry reads as '' — never `undefined` in the form.
    expect(detail.billingStreet).toBe('')
  })
})

/**
 * KLANT-FASE-1 — the lifecycle phase must reach the server. The drawer picker and the
 * create modal both write `phase`; if FIELD_MAP/the create body drop it, the PATCH body
 * comes out EMPTY and no request is sent at all (§3: exactly the fake-affordance class
 * this repo has been bitten by). These assert the REQUEST — route + body.
 */
describe('useCustomerRecord · customer phase (KLANT-FASE-1)', () => {
  it('PATCHes the phase slug to /customers/{id} — the drawer picker really persists', async () => {
    mockedPatch.mockResolvedValue({})
    const r = harness([customer({ id: 1, phase: 'prospect' } as Partial<Customer>)])
    act(() => { r.result.current.record.updateCustomer(1, { phase: 'klant' }) })

    expect(mockedPatch).toHaveBeenCalledWith('/customers/1', { phase: 'klant' })
    await waitFor(() => expect((r.result.current.customers[0] as Customer).phase).toBe('klant'))
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('reverts the phase and reports the server message when the PATCH is refused', async () => {
    mockedPatch.mockRejectedValue({ response: { status: 422, data: { message: 'Onbekende fase' } } })
    const r = harness([customer({ id: 1, phase: 'prospect' } as Partial<Customer>)])
    act(() => { r.result.current.record.updateCustomer(1, { phase: 'klant' }) })

    await waitFor(() => expect((r.result.current.customers[0] as Customer).phase).toBe('prospect'))
    expect(notifyError).toHaveBeenCalledWith('Onbekende fase')
  })

  it('POSTs the chosen phase on create', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 9, name: 'Nieuw', phase: 'klant' } })
    const r = harness([])
    await act(async () => {
      await r.result.current.record.handleCreate({
        name: 'Nieuw', debtorNumber: '', status: 'active', ownerId: '', industry: '', city: '', phase: 'klant',
      })
    })

    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/customers', expect.objectContaining({ phase: 'klant' }))
  })

  it('omits phase from the create body when none was picked — an empty slug would be a 422', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 10, name: 'Nieuw' } })
    const r = harness([])
    await act(async () => {
      await r.result.current.record.handleCreate({
        name: 'Nieuw', debtorNumber: '', status: 'active', ownerId: '', industry: '', city: '', phase: '',
      })
    })

    const body = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>
    expect(body).not.toHaveProperty('phase')
  })

  // CLEAR-SWEEP (Danny 13-08): industry/owner_id moved into the conditional
  // OPTIONAL_CREATE_FIELDS-style treatment once their pickers became clearable —
  // this asserts the REQUEST body (§13), not only that handleCreate resolved.
  it('sends industry and owner_id on the create body once picked', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 11, name: 'Nieuw' } })
    const r = harness([])
    await act(async () => {
      await r.result.current.record.handleCreate({
        name: 'Nieuw', debtorNumber: '', status: 'active', ownerId: 'u1', industry: 'Zorg', city: '', phase: '',
      })
    })

    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/customers', expect.objectContaining({ industry: 'Zorg', owner_id: 'u1' }))
  })

  it('CLEAR-SWEEP: omits industry and owner_id from the create body when cleared back to empty', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 12, name: 'Nieuw' } })
    const r = harness([])
    await act(async () => {
      await r.result.current.record.handleCreate({
        name: 'Nieuw', debtorNumber: '', status: 'active', ownerId: '', industry: '', city: '', phase: '',
      })
    })

    const body = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>
    expect(body).not.toHaveProperty('industry')
    expect(body).not.toHaveProperty('owner_id')
  })
})

/**
 * NOTES-LOC-DEPT-1 — the composer's picked level (customer_contact_id/
 * customer_location_id/customer_department_id) must reach the exact POST body
 * addNote sends, unchanged. Asserts the REQUEST (§13), not only that a callback fired.
 */
describe('useCustomerRecord · addNote (NOTES-LOC-DEPT-1)', () => {
  it('POSTs the contact link when the composer picked a contact', () => {
    vi.mocked(api.post).mockResolvedValue({})
    const r = harness([customer({ id: 1 })])
    act(() => { r.result.current.record.addNote(1, { type: 'general', title: '', body: 'Belafspraak', customer_contact_id: 'con-1' }) })

    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/customers/1/notes', {
      type: 'general', title: '', text: 'Belafspraak',
      customer_contact_id: 'con-1', customer_location_id: undefined, customer_department_id: undefined,
    })
  })

  it('POSTs the location link when the composer picked a location', () => {
    vi.mocked(api.post).mockResolvedValue({})
    const r = harness([customer({ id: 1 })])
    act(() => { r.result.current.record.addNote(1, { type: 'general', title: '', body: 'Bezoek gepland', customer_location_id: 'loc-1' }) })

    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/customers/1/notes', {
      type: 'general', title: '', text: 'Bezoek gepland',
      customer_contact_id: undefined, customer_location_id: 'loc-1', customer_department_id: undefined,
    })
  })

  it('POSTs the department link when the composer picked a department', () => {
    vi.mocked(api.post).mockResolvedValue({})
    const r = harness([customer({ id: 1 })])
    act(() => { r.result.current.record.addNote(1, { type: 'general', title: '', body: 'Personeelswissel', customer_department_id: 'dep-1' }) })

    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/customers/1/notes', {
      type: 'general', title: '', text: 'Personeelswissel',
      customer_contact_id: undefined, customer_location_id: undefined, customer_department_id: 'dep-1',
    })
  })

  it('adds an optimistic row carrying the picked link id (name resolves once the real detail reloads)', async () => {
    mockedGet.mockResolvedValue({ data: { id: 1, name: 'Test customer' } })
    vi.mocked(api.post).mockResolvedValue({})
    const r = harness([customer({ id: 1 })])
    act(() => { r.result.current.record.selectCustomer(customer({ id: 1 })) })
    await waitFor(() => expect(r.result.current.record.detail?.id).toBe(1))

    act(() => { r.result.current.record.addNote(1, { type: 'general', title: '', body: 'Bezoek gepland', customer_location_id: 'loc-1' }) })

    const optimisticNote = r.result.current.record.detail?.notes?.[0]
    expect(optimisticNote).toMatchObject({ locationId: 'loc-1', locationName: '', departmentId: null, contactId: null })
  })
})

/**
 * K15NOTES — edit/delete a single customer note. Asserts the REQUEST (§13): the
 * exact PATCH/DELETE route + body, the optimistic write, and revert-on-failure.
 */
describe('useCustomerRecord · editNote/deleteNote (K15NOTES)', () => {
  const withNote = customer({
    id: 1,
    notes: [{ id: 'n-1', type: 'general', title: '', text: 'Origineel', ago: '', contactId: null, contactName: '', locationId: null, locationName: '', departmentId: null, departmentName: '' }],
  })

  it('PATCHes the exact route + body and updates the note optimistically', async () => {
    mockedGet.mockResolvedValue({ data: withNote })
    mockedPatch.mockResolvedValue({})
    const r = harness([withNote])
    act(() => { r.result.current.record.selectCustomer(withNote) })
    await waitFor(() => expect(r.result.current.record.detail?.id).toBe(1))

    act(() => {
      r.result.current.record.editNote(1, 'n-1', { type: 'general', title: '', body: 'Bijgewerkt' })
    })

    expect(mockedPatch).toHaveBeenCalledWith('/customers/1/notes/n-1', { type: 'general', text: 'Bijgewerkt', language: undefined })
    expect(r.result.current.record.detail?.notes?.[0]).toMatchObject({ id: 'n-1', text: 'Bijgewerkt' })
  })

  it('reverts the optimistic edit when the PATCH fails', async () => {
    mockedGet.mockResolvedValue({ data: withNote })
    mockedPatch.mockRejectedValue({ response: { status: 500 } })
    const r = harness([withNote])
    act(() => { r.result.current.record.selectCustomer(withNote) })
    await waitFor(() => expect(r.result.current.record.detail?.id).toBe(1))

    act(() => {
      r.result.current.record.editNote(1, 'n-1', { type: 'general', title: '', body: 'Bijgewerkt' })
    })
    await waitFor(() => expect(notifyError).toHaveBeenCalled())

    expect(r.result.current.record.detail?.notes?.[0]).toMatchObject({ id: 'n-1', text: 'Origineel' })
  })

  it('DELETEs the exact route and removes the note optimistically', async () => {
    mockedGet.mockResolvedValue({ data: withNote })
    vi.mocked(api.delete).mockResolvedValue({})
    const r = harness([withNote])
    act(() => { r.result.current.record.selectCustomer(withNote) })
    await waitFor(() => expect(r.result.current.record.detail?.id).toBe(1))

    act(() => { r.result.current.record.deleteNote(1, 'n-1') })

    expect(vi.mocked(api.delete)).toHaveBeenCalledWith('/customers/1/notes/n-1')
    expect(r.result.current.record.detail?.notes ?? []).toHaveLength(0)
  })

  it('reverts the optimistic delete when the DELETE fails', async () => {
    mockedGet.mockResolvedValue({ data: withNote })
    vi.mocked(api.delete).mockRejectedValue({ response: { status: 500 } })
    const r = harness([withNote])
    act(() => { r.result.current.record.selectCustomer(withNote) })
    await waitFor(() => expect(r.result.current.record.detail?.id).toBe(1))

    act(() => { r.result.current.record.deleteNote(1, 'n-1') })
    await waitFor(() => expect(notifyError).toHaveBeenCalled())

    expect(r.result.current.record.detail?.notes ?? []).toHaveLength(1)
  })
})

// TRASH-OVERAL-2: restore-to-active stays the separate per-id /restore route —
// REQUEST-asserting (§13), plus the local lifecycle reconcile across the slices.
describe('useCustomerRecord · restoreCustomer (TRASH-OVERAL-2)', () => {
  it('POSTs /customers/{id}/restore and clears archived + lifecycle on the list row', async () => {
    vi.mocked(api.post).mockResolvedValue({})
    const r = harness([customer({ id: 1, archived: true, archivedAt: '2026-08-01T10:00:00Z', lifecycle: 'archived', pendingEraseAt: null })])

    act(() => { r.result.current.record.restoreCustomer(1) })

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/customers/1/restore'))
    await waitFor(() => expect(r.result.current.customers[0].archived).toBe(false))
    expect(r.result.current.customers[0].lifecycle).toBe('active')
    expect(r.result.current.customers[0].archivedAt).toBeNull()
  })

  it('keeps the archived state and reports failure when the POST is refused', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 403 } })
    const r = harness([customer({ id: 1, archived: true, lifecycle: 'archived' })])

    act(() => { r.result.current.record.restoreCustomer(1) })

    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect(r.result.current.customers[0].archived).toBe(true)
  })
})
