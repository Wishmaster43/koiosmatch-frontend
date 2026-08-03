/**
 * useCustomerContacts — covers the two gaps called out for this hook (Danny 2026-07-14):
 * (1) the defensive dedupe-by-id on load (two seeded rows with the same id must render
 * once), and (2) the create/update payload mapping (`toApi`) — snake_case field names,
 * partial-patch semantics, and that the multi-value locations/departments arrays survive
 * the round trip on the mapped Contact (CONTACT-MULTI-1 passthrough via mapContact).
 * `api` is mocked; `unwrap`/`unwrapList` are the REAL implementations (pure helpers).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  useCustomerContacts, CONTACTS_CHANGED_EVENT, setLocationPrimaryContact,
  primaryLocationIdsOf, isPrimaryForLocation, archiveContact, restoreContact,
  useArchivedCustomerContacts, type ContactPayload,
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
const mockPost  = api.post  as unknown as ReturnType<typeof vi.fn>
const mockPatch = api.patch as unknown as ReturnType<typeof vi.fn>
const mockPut   = api.put   as unknown as ReturnType<typeof vi.fn>

beforeEach(() => { mockGet.mockReset(); mockPost.mockReset(); mockPatch.mockReset(); mockPut.mockReset() })

// A full payload — every ContactPayload field populated, to exercise the whole toApi map.
// BE 2026-07-20: `mobile` is now a separate field from the landline `phone`.
const fullPayload: ContactPayload = {
  firstName: 'Anna', middleName: 'de', lastName: 'Bakker', email: 'anna@bakker.nl', phone: '0301234567', mobile: '0612345678', role: 'Manager',
  // CONTACT-GESLACHT-1: the gender VALUE SLUG, not an id.
  gender: 'female',
  locationId: 'loc1', departmentId: 'dep1', locationIds: ['loc1'], departmentIds: ['dep1'], statusId: 'st1', isPrimary: true, customFields: { badge: 'vip' },
}

describe('useCustomerContacts · dedupe-by-id on load', () => {
  it('collapses two rows sharing the same id into one', async () => {
    mockGet.mockResolvedValue({ data: { data: [
      { id: 'c1', first_name: 'Jill', last_name: 'A', email: 'jill@x.nl' },
      { id: 'c1', first_name: 'Jill', last_name: 'A', email: 'jill@x.nl' },
      { id: 'c2', first_name: 'Bob', last_name: 'B', email: 'bob@x.nl' },
    ] } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.contacts.map(c => c.id)).toEqual(['c1', 'c2'])
  })

  it('keeps distinct ids untouched (no over-eager collapsing)', async () => {
    mockGet.mockResolvedValue({ data: { data: [
      { id: 'a', first_name: 'A' }, { id: 'b', first_name: 'B' }, { id: 'c', first_name: 'C' },
    ] } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.contacts).toHaveLength(3)
  })
})

describe('useCustomerContacts · create payload mapping (toApi)', () => {
  it('maps every field to its snake_case API name', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    mockPost.mockResolvedValue({ data: { data: { id: 'srv1' } } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.add(fullPayload) })

    expect(mockPost).toHaveBeenCalledWith('/customers/cust1/contacts', {
      first_name: 'Anna', middle_name: 'de', last_name: 'Bakker', email: 'anna@bakker.nl', phone: '0301234567', mobile: '0612345678', function: 'Manager',
      gender: 'female',
      customer_location_id: 'loc1', customer_department_id: 'dep1', status_id: 'st1', is_primary: true,
      location_ids: ['loc1'], department_ids: ['dep1'],
      custom_fields: { badge: 'vip' },
    })
  })

  it('sends null (not undefined/omitted) for an explicitly cleared location/department', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    mockPost.mockResolvedValue({ data: { data: { id: 'srv1' } } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.add({ ...fullPayload, locationId: null, departmentId: null, locationIds: [], departmentIds: [] }) })

    const body = mockPost.mock.calls[0][1]
    expect(body.customer_location_id).toBeNull()
    // An EMPTY ARRAY is a real "clear" for the pivot (ContactLocationSync checks presence,
    // not truthiness), and the department's singular id must be nulled alongside it —
    // the sync derives that one for locations but not for departments.
    expect(body.location_ids).toEqual([])
    expect(body.department_ids).toEqual([])
    expect(body.customer_department_id).toBeNull()
  })

  it('passes the multi-value locations/departments arrays through on the created contact (CONTACT-MULTI-1)', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    mockPost.mockResolvedValue({ data: { data: {
      id: 'srv1', first_name: 'Anna', last_name: 'Bakker',
      locations: [{ id: 'loc1', name: 'HQ' }, { id: 'loc2', name: 'Branch' }],
      departments: [{ id: 'dep1', name: 'Sales' }],
    } } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let saved: { locations?: unknown; departments?: unknown } | null | undefined
    await act(async () => { saved = await result.current.add(fullPayload) })

    expect(saved?.locations).toEqual([{ id: 'loc1', name: 'HQ' }, { id: 'loc2', name: 'Branch' }])
    expect(saved?.departments).toEqual([{ id: 'dep1', name: 'Sales' }])
  })
})

describe('useCustomerContacts · update payload mapping (toApi, partial)', () => {
  it('only sends the fields actually passed to update() — not the whole row', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 'c1', first_name: 'A', last_name: 'B' }] } })
    mockPatch.mockResolvedValue({ data: { data: { id: 'c1', customer_location_id: 'loc9' } } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.update('c1', { locationId: 'loc9' }) })

    expect(mockPatch).toHaveBeenCalledWith('/customers/cust1/contacts/c1', { customer_location_id: 'loc9' })
  })

  it('maps a multi-field partial update (role + isPrimary) with the same snake_case names', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 'c1', first_name: 'A', last_name: 'B' }] } })
    mockPatch.mockResolvedValue({ data: { data: { id: 'c1' } } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.update('c1', { role: 'Teamlead', isPrimary: false }) })

    expect(mockPatch).toHaveBeenCalledWith('/customers/cust1/contacts/c1', { function: 'Teamlead', is_primary: false })
  })

  // BE 2026-07-20: mobile is its OWN patch key, independent of phone — the
  // ContactDetail numbers card can save just one of the two without touching the other.
  it('maps a mobile-only partial update to its own key, without touching phone', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 'c1', first_name: 'A', last_name: 'B', phone: '0301234567' }] } })
    mockPatch.mockResolvedValue({ data: { data: { id: 'c1', mobile: '0687654321' } } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.update('c1', { mobile: '0687654321' }) })

    expect(mockPatch).toHaveBeenCalledWith('/customers/cust1/contacts/c1', { mobile: '0687654321' })
  })
})

describe('useCustomerContacts · mobile passthrough on mapContact (BE 2026-07-20)', () => {
  it('maps the API mobile field onto the contact, independent of phone', async () => {
    mockGet.mockResolvedValue({ data: { data: [
      { id: 'c1', first_name: 'Jill', last_name: 'A', phone: '0301234567', mobile: '0612345678' },
    ] } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.contacts[0].phone).toBe('0301234567')
    expect(result.current.contacts[0].mobile).toBe('0612345678')
  })
})

/**
 * CONTACT-GESLACHT-1 — the backend column is `gender` and carries the candidate_genders
 * VALUE SLUG, validated with `exists:candidate_genders,value`. Sending `gender_id`, or an
 * id, or an empty string all 422 — so the request itself is what these assert.
 */
describe('useCustomerContacts · gender (CONTACT-GESLACHT-1)', () => {
  it('PATCHes the gender SLUG under the key `gender` — never gender_id', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 'c1', first_name: 'Jill', last_name: 'A' }] } })
    mockPatch.mockResolvedValue({ data: { data: { id: 'c1', gender: 'male' } } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.update('c1', { gender: 'male' }) })

    expect(mockPatch).toHaveBeenCalledWith('/customers/cust1/contacts/c1', { gender: 'male' })
    expect(mockPatch.mock.calls[0][1]).not.toHaveProperty('gender_id')
  })

  it('sends null for a cleared gender — the column is nullable but "" fails the exists: rule', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 'c1', first_name: 'Jill', last_name: 'A' }] } })
    mockPatch.mockResolvedValue({ data: { data: { id: 'c1' } } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.update('c1', { gender: '' }) })

    expect(mockPatch).toHaveBeenCalledWith('/customers/cust1/contacts/c1', { gender: null })
  })

  it('maps the resource `gender` slug onto the contact', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 'c1', first_name: 'Jill', last_name: 'A', gender: 'female' }] } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.contacts[0].gender).toBe('female')
  })
})

/**
 * CONTACT-LAATSTE-CONTACT-1 — the columns always existed; CustomerContactResource simply
 * never exposed them, so the table's "Laatste contact" column rendered a dash forever.
 */
describe('useCustomerContacts · last contact passthrough', () => {
  it('maps last_contact_at + last_contact_type off the resource', async () => {
    mockGet.mockResolvedValue({ data: { data: [
      { id: 'c1', first_name: 'Jill', last_name: 'A', last_contact_at: '2026-07-14T09:30:00+02:00', last_contact_type: 'phone' },
    ] } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.contacts[0].lastContactAt).toBe('2026-07-14T09:30:00+02:00')
    expect(result.current.contacts[0].lastContactType).toBe('phone')
  })

  it('leaves both null when the resource omits them (never an empty-string date)', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 'c1', first_name: 'Jill', last_name: 'A' }] } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.contacts[0].lastContactAt).toBeNull()
    expect(result.current.contacts[0].lastContactType).toBeNull()
  })

  it('maps customer_id, which scopes the merge route', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 'c1', first_name: 'Jill', last_name: 'A', customer_id: 'cust1' }] } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.contacts[0].customerId).toBe('cust1')
  })
})

/**
 * The merge happens five ContactsPanel call sites away from this hook, so it broadcasts
 * CONTACTS_CHANGED_EVENT instead of prop-drilling a writer. If this listener regresses,
 * a merged-away duplicate keeps rendering until the whole drawer is reopened.
 */
describe('useCustomerContacts · CONTACTS_CHANGED_EVENT', () => {
  it('refetches the list when the event fires', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 'c1', first_name: 'Jill', last_name: 'A' }] } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const initialCalls = mockGet.mock.calls.length

    await act(async () => { window.dispatchEvent(new CustomEvent(CONTACTS_CHANGED_EVENT)) })

    await waitFor(() => expect(mockGet.mock.calls.length).toBe(initialCalls + 1))
    expect(mockGet.mock.calls.at(-1)?.[0]).toBe('/customers/cust1/contacts')
  })

  it('stops listening once unmounted — no refetch for a drawer that is gone', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    const { result, unmount } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    unmount()
    const afterUnmount = mockGet.mock.calls.length

    await act(async () => { window.dispatchEvent(new CustomEvent(CONTACTS_CHANGED_EVENT)) })

    expect(mockGet.mock.calls.length).toBe(afterUnmount)
  })
})

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
 * ARCHIVE-SUBENTITY-1 — the reversible soft-delete pair. Standalone functions
 * (not hook-returned callbacks), mirroring setLocationPrimaryContact above —
 * fired from deep inside ContactDetail, several hops from this hook's owner.
 */
describe('useCustomerContacts · archiveContact / restoreContact (ARCHIVE-SUBENTITY-1)', () => {
  it('archiveContact POSTs the archive route and dispatches CONTACTS_CHANGED_EVENT', async () => {
    mockPost.mockResolvedValue({ data: {} })
    const onChanged = vi.fn()
    window.addEventListener(CONTACTS_CHANGED_EVENT, onChanged)

    await archiveContact('cust1', 'c1')

    expect(mockPost).toHaveBeenCalledWith('/customers/cust1/contacts/c1/archive')
    expect(onChanged).toHaveBeenCalledTimes(1)
    window.removeEventListener(CONTACTS_CHANGED_EVENT, onChanged)
  })

  it('restoreContact POSTs the restore route, dispatches the event and returns the mapped contact', async () => {
    mockPost.mockResolvedValue({ data: { data: { id: 'c1', first_name: 'Jill', last_name: 'A', archived: false } } })
    const onChanged = vi.fn()
    window.addEventListener(CONTACTS_CHANGED_EVENT, onChanged)

    const restored = await restoreContact('cust1', 'c1')

    expect(mockPost).toHaveBeenCalledWith('/customers/cust1/contacts/c1/restore')
    expect(restored.id).toBe('c1')
    expect(onChanged).toHaveBeenCalledTimes(1)
    window.removeEventListener(CONTACTS_CHANGED_EVENT, onChanged)
  })
})

/**
 * ARCHIVE-SUBENTITY-1 — the archived-only sub-fetch behind the panel's
 * "Gearchiveerd" quick-view. A SEPARATE fetch from the live list above, so the
 * live list's own consumers (couple pickers etc.) never see archived rows leak in.
 */
describe('useCustomerContacts · useArchivedCustomerContacts (ARCHIVE-SUBENTITY-1)', () => {
  it('fires no request while inactive', () => {
    renderHook(() => useArchivedCustomerContacts('cust1', false))
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('requests include_archived=1 and keeps only the archived rows once active', async () => {
    mockGet.mockResolvedValue({ data: { data: [
      { id: 'c1', first_name: 'Live', last_name: 'One', archived: false },
      { id: 'c2', first_name: 'Gone', last_name: 'Two', archived: true },
    ] } })
    const { result } = renderHook(() => useArchivedCustomerContacts('cust1', true))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockGet).toHaveBeenCalledWith('/customers/cust1/contacts', expect.objectContaining({ params: { include_archived: 1 } }))
    expect(result.current.contacts.map(c => c.id)).toEqual(['c2'])
  })
})
