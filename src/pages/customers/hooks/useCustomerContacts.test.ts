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
import { useCustomerContacts, type ContactPayload } from './useCustomerContacts'

// Stub only the axios-like client; unwrap/unwrapList stay real (pure, no network).
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
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

beforeEach(() => { mockGet.mockReset(); mockPost.mockReset(); mockPatch.mockReset() })

// A full payload — every ContactPayload field populated, to exercise the whole toApi map.
const fullPayload: ContactPayload = {
  firstName: 'Anna', lastName: 'Bakker', email: 'anna@bakker.nl', phone: '0612345678', role: 'Manager',
  locationId: 'loc1', departmentId: 'dep1', statusId: 'st1', isPrimary: true, customFields: { badge: 'vip' },
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
      first_name: 'Anna', last_name: 'Bakker', email: 'anna@bakker.nl', phone: '0612345678', function: 'Manager',
      customer_location_id: 'loc1', customer_department_id: 'dep1', status_id: 'st1', is_primary: true,
      custom_fields: { badge: 'vip' },
    })
  })

  it('sends null (not undefined/omitted) for an explicitly cleared location/department', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    mockPost.mockResolvedValue({ data: { data: { id: 'srv1' } } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.add({ ...fullPayload, locationId: null, departmentId: null }) })

    const body = mockPost.mock.calls[0][1]
    expect(body.customer_location_id).toBeNull()
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
})
