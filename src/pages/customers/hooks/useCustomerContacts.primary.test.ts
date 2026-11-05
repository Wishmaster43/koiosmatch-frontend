/** useCustomerContacts · per-location and per-department primary (split from useCustomerContacts.test.ts; same mocks). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import {
  useCustomerContacts, CONTACTS_CHANGED_EVENT, setLocationPrimaryContact,
  primaryLocationIdsOf, isPrimaryForLocation,
  // CONTACT-DEPARTMENT-PRIMARY-1: the exact department twin under test below.
  setDepartmentPrimaryContact, primaryDepartmentIdsOf, isPrimaryForDepartment,
} from './useCustomerContacts'
import type { Contact } from '@/types/customer'

// Stub only the axios-like client; unwrap/unwrapList stay real (pure, no network).
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  unwrap: (res: { data?: unknown }) => {
    const body = (res as { data?: unknown })?.data ?? res
    return (body && typeof body === 'object' && !Array.isArray(body) && 'data' in (body as object))
      ? (body as { data: unknown }).data
      : body
  },
  unwrapList: (res: { data?: unknown }) => {
    const body = (res as { data?: unknown })?.data ?? res
    const rows = Array.isArray(body) ? body : Array.isArray((body as { data?: unknown })?.data) ? (body as { data: unknown[] }).data : []
    return { rows, total: rows.length, page: 1, lastPage: 1, perPage: rows.length }
  },
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import api from '@/lib/api'
const mockGet   = api.get   as unknown as ReturnType<typeof vi.fn>
const mockPatch = api.patch as unknown as ReturnType<typeof vi.fn>
const mockPut   = api.put   as unknown as ReturnType<typeof vi.fn>

beforeEach(() => { mockGet.mockReset(); mockPatch.mockReset(); mockPut.mockReset() })

/**
 * CONTACT-LOCATION-PRIMARY-1 — the PER-LOCATION primary contact. Measured against the
 * backend before these were written:
 *   route    PUT /customers/{customerId}/contacts/{id}/locations/{locationId}/primary
 *            (routes/api/tenant/customers.php, permission:customers.update)
 *   handler  CustomerContactController::primaryLocation → markPrimaryForLocation()
 *   read     CustomerContactResource → locations[].is_primary (the pivot flag)
 *
 * This is a DIFFERENT column from customer_contacts.is_primary (the customer's one main
 * contact). Conflating them is the exact mistake these tests exist to prevent, so they
 * assert the two axes stay apart as well as that the request is the real one.
 */
describe('useCustomerContacts · per-location primary (CONTACT-LOCATION-PRIMARY-1)', () => {
  it('PUTs the measured per-location route — never the customer-level PATCH', async () => {
    mockPut.mockResolvedValue({ data: { data: { id: 'c1', locations: [{ id: 'loc-1', name: 'Noord', is_primary: true }] } } })

    await setLocationPrimaryContact('cust1', 'c1', 'loc-1')

    expect(mockPut).toHaveBeenCalledTimes(1)
    expect(mockPut).toHaveBeenCalledWith('/customers/cust1/contacts/c1/locations/loc-1/primary')
    // The customer axis has its own field on its own route; this must not touch it.
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('reports success and tells the list to refetch when the flag actually landed', async () => {
    mockPut.mockResolvedValue({ data: { data: { id: 'c1', locations: [{ id: 'loc-1', name: 'Noord', is_primary: true }] } } })
    const onChanged = vi.fn()
    window.addEventListener(CONTACTS_CHANGED_EVENT, onChanged)

    await expect(setLocationPrimaryContact('cust1', 'c1', 'loc-1')).resolves.toBe(true)

    expect(onChanged).toHaveBeenCalledTimes(1)
    window.removeEventListener(CONTACTS_CHANGED_EVENT, onChanged)
  })

  /**
   * The endpoint is a documented NO-OP while the pivot column is missing on a tenant
   * database (CustomerContactLocation::supportsPrimary) — it still answers 200 with the
   * flag unchanged. Assuming success there is precisely how a control lies about a write
   * that never happened, so the reconcile is asserted, not the HTTP status.
   */
  it('reports failure and fires no refetch when the 200 came back with the flag unchanged', async () => {
    mockPut.mockResolvedValue({ data: { data: { id: 'c1', locations: [{ id: 'loc-1', name: 'Noord', is_primary: false }] } } })
    const onChanged = vi.fn()
    window.addEventListener(CONTACTS_CHANGED_EVENT, onChanged)

    await expect(setLocationPrimaryContact('cust1', 'c1', 'loc-1')).resolves.toBe(false)

    expect(onChanged).not.toHaveBeenCalled()
    window.removeEventListener(CONTACTS_CHANGED_EVENT, onChanged)
  })

  it('reports failure when the response omits the pivot flag entirely (older resource)', async () => {
    mockPut.mockResolvedValue({ data: { data: { id: 'c1', locations: [{ id: 'loc-1', name: 'Noord' }] } } })
    await expect(setLocationPrimaryContact('cust1', 'c1', 'loc-1')).resolves.toBe(false)
  })

  it('maps locations[].is_primary onto the row — only the flagged sites', async () => {
    mockGet.mockResolvedValue({ data: { data: [{
      id: 'c1', first_name: 'Joost', last_name: 'de Boer',
      locations: [
        { id: 'loc-1', name: 'Noord', is_primary: true },
        { id: 'loc-2', name: 'Zuid', is_primary: false },
        { id: 'loc-3', name: 'West' },
      ],
    }] } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(primaryLocationIdsOf(result.current.contacts[0])).toEqual(['loc-1'])
    expect(isPrimaryForLocation(result.current.contacts[0], 'loc-1')).toBe(true)
    expect(isPrimaryForLocation(result.current.contacts[0], 'loc-2')).toBe(false)
  })

  it('keeps the two primary axes apart — customer-primary is not location-primary', async () => {
    mockGet.mockResolvedValue({ data: { data: [
      // The customer's ONE main contact, primary at no site in particular.
      { id: 'c1', first_name: 'Anna', last_name: 'Bakker', is_primary: true, locations: [{ id: 'loc-1', name: 'Noord', is_primary: false }] },
      // Primary AT loc-1, but not the customer's main contact.
      { id: 'c2', first_name: 'Joost', last_name: 'de Boer', is_primary: false, locations: [{ id: 'loc-1', name: 'Noord', is_primary: true }] },
    ] } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const [anna, joost] = result.current.contacts
    expect(anna.isPrimary).toBe(true)
    expect(isPrimaryForLocation(anna, 'loc-1')).toBe(false)
    expect(joost.isPrimary).toBe(false)
    expect(isPrimaryForLocation(joost, 'loc-1')).toBe(true)
  })

  it('degrades to no location-primary for a row that never came from this hook', () => {
    // The flags ride ALONG the row; a Contact built elsewhere simply has none.
    expect(primaryLocationIdsOf({ id: 'x' } as Contact)).toEqual([])
    expect(isPrimaryForLocation({ id: 'x' } as Contact, 'loc-1')).toBe(false)
  })
})

/**
 * CONTACT-DEPARTMENT-PRIMARY-1 — the exact department twin of the per-location suite
 * above. Measured against the backend before this was written:
 *   route    PUT /customers/{customerId}/contacts/{id}/departments/{departmentId}/primary
 *            (routes/api/tenant/customers.php:181, permission:customers.update)
 *   handler  CustomerContactController::primaryDepartment → mirrors primaryLocation
 *   read     CustomerContactResource → departments[].is_primary (the pivot flag)
 * Same three failure modes as CONTACT-LOCATION-PRIMARY-1: wrong/no request, assuming a
 * 200 always means the write landed, and blurring this axis with the other two.
 */
describe('useCustomerContacts · per-department primary (CONTACT-DEPARTMENT-PRIMARY-1)', () => {
  it('PUTs the measured per-department route — never the location or customer-level ones', async () => {
    mockPut.mockResolvedValue({ data: { data: { id: 'c1', departments: [{ id: 'dep-1', name: 'Zorg', is_primary: true }] } } })

    await setDepartmentPrimaryContact('cust1', 'c1', 'dep-1')

    expect(mockPut).toHaveBeenCalledTimes(1)
    expect(mockPut).toHaveBeenCalledWith('/customers/cust1/contacts/c1/departments/dep-1/primary')
    // Neither sibling axis has its own route touched by this call.
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('reports success and tells the list to refetch when the flag actually landed', async () => {
    mockPut.mockResolvedValue({ data: { data: { id: 'c1', departments: [{ id: 'dep-1', name: 'Zorg', is_primary: true }] } } })
    const onChanged = vi.fn()
    window.addEventListener(CONTACTS_CHANGED_EVENT, onChanged)

    await expect(setDepartmentPrimaryContact('cust1', 'c1', 'dep-1')).resolves.toBe(true)

    expect(onChanged).toHaveBeenCalledTimes(1)
    window.removeEventListener(CONTACTS_CHANGED_EVENT, onChanged)
  })

  /**
   * Same documented no-op as the location route while the pivot column is missing on a
   * tenant database — a 200 with the flag unchanged is still a failure for the user.
   */
  it('reports failure and fires no refetch when the 200 came back with the flag unchanged', async () => {
    mockPut.mockResolvedValue({ data: { data: { id: 'c1', departments: [{ id: 'dep-1', name: 'Zorg', is_primary: false }] } } })
    const onChanged = vi.fn()
    window.addEventListener(CONTACTS_CHANGED_EVENT, onChanged)

    await expect(setDepartmentPrimaryContact('cust1', 'c1', 'dep-1')).resolves.toBe(false)

    expect(onChanged).not.toHaveBeenCalled()
    window.removeEventListener(CONTACTS_CHANGED_EVENT, onChanged)
  })

  it('reports failure when the response omits the pivot flag entirely (older resource)', async () => {
    mockPut.mockResolvedValue({ data: { data: { id: 'c1', departments: [{ id: 'dep-1', name: 'Zorg' }] } } })
    await expect(setDepartmentPrimaryContact('cust1', 'c1', 'dep-1')).resolves.toBe(false)
  })

  it('maps departments[].is_primary onto the row — only the flagged departments', async () => {
    mockGet.mockResolvedValue({ data: { data: [{
      id: 'c1', first_name: 'Joost', last_name: 'de Boer',
      departments: [
        { id: 'dep-1', name: 'Zorg', is_primary: true },
        { id: 'dep-2', name: 'Techniek', is_primary: false },
        { id: 'dep-3', name: 'HR' },
      ],
    }] } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(primaryDepartmentIdsOf(result.current.contacts[0])).toEqual(['dep-1'])
    expect(isPrimaryForDepartment(result.current.contacts[0], 'dep-1')).toBe(true)
    expect(isPrimaryForDepartment(result.current.contacts[0], 'dep-2')).toBe(false)
  })

  it('keeps this axis apart from the location and customer axes', async () => {
    mockGet.mockResolvedValue({ data: { data: [
      // Primary at dep-1, primary at loc-1, and the customer's one main contact — three
      // different flags on one row, none of which imply another.
      { id: 'c1', first_name: 'Anna', last_name: 'Bakker', is_primary: true,
        locations: [{ id: 'loc-1', name: 'Noord', is_primary: false }],
        departments: [{ id: 'dep-1', name: 'Zorg', is_primary: false }] },
      { id: 'c2', first_name: 'Joost', last_name: 'de Boer', is_primary: false,
        locations: [{ id: 'loc-1', name: 'Noord', is_primary: false }],
        departments: [{ id: 'dep-1', name: 'Zorg', is_primary: true }] },
    ] } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const [anna, joost] = result.current.contacts
    expect(anna.isPrimary).toBe(true)
    expect(isPrimaryForDepartment(anna, 'dep-1')).toBe(false)
    expect(joost.isPrimary).toBe(false)
    expect(isPrimaryForDepartment(joost, 'dep-1')).toBe(true)
  })

  it('degrades to no department-primary for a row that never came from this hook', () => {
    // The flags ride ALONG the row; a Contact built elsewhere simply has none.
    expect(primaryDepartmentIdsOf({ id: 'x' } as Contact)).toEqual([])
    expect(isPrimaryForDepartment({ id: 'x' } as Contact, 'dep-1')).toBe(false)
  })
})
