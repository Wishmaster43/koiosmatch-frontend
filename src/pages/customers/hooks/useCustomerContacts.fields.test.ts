/** useCustomerContacts · LinkedIn, last contact, change event (split from useCustomerContacts.test.ts; same mocks). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCustomerContacts, CONTACTS_CHANGED_EVENT } from './useCustomerContacts'

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

beforeEach(() => { mockGet.mockReset(); mockPatch.mockReset() })

/**
 * CONTACT-LINKEDIN-1 (Danny 05-08) — the backend column is `linkedin_slug`, writable
 * on both create and update and read back through the resource under the same key
 * (symmetric, unlike the candidate's linkedin/linkedin_slug split). The FE strips a
 * pasted full URL down to the bare slug at this exact save boundary (toApi), so the
 * request body is what these assert, never just that a callback fired (§13).
 */
describe('useCustomerContacts · LinkedIn slug (CONTACT-LINKEDIN-1)', () => {
  it('PATCHes a bare slug through unchanged, under the key linkedin_slug', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 'c1', first_name: 'Jill', last_name: 'A' }] } })
    mockPatch.mockResolvedValue({ data: { data: { id: 'c1', linkedin_slug: 'jill-a-1' } } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.update('c1', { linkedin: 'jill-a-1' }) })

    expect(mockPatch).toHaveBeenCalledWith('/customers/cust1/contacts/c1', { linkedin_slug: 'jill-a-1' })
  })

  it('strips a pasted full LinkedIn URL down to the slug before it is sent', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 'c1', first_name: 'Jill', last_name: 'A' }] } })
    mockPatch.mockResolvedValue({ data: { data: { id: 'c1', linkedin_slug: 'jill-a-1' } } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.update('c1', { linkedin: 'https://www.linkedin.com/in/jill-a-1' }) })

    expect(mockPatch).toHaveBeenCalledWith('/customers/cust1/contacts/c1', { linkedin_slug: 'jill-a-1' })
  })

  it('sends null (not an empty string) for a cleared LinkedIn field — the backend treats null as the legitimate "cleared" value', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 'c1', first_name: 'Jill', last_name: 'A' }] } })
    mockPatch.mockResolvedValue({ data: { data: { id: 'c1' } } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.update('c1', { linkedin: '' }) })

    expect(mockPatch).toHaveBeenCalledWith('/customers/cust1/contacts/c1', { linkedin_slug: null })
  })

  it('maps the resource linkedin_slug onto the contact as `linkedin`', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 'c1', first_name: 'Jill', last_name: 'A', linkedin_slug: 'jill-a-1' }] } })
    const { result } = renderHook(() => useCustomerContacts('cust1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.contacts[0].linkedin).toBe('jill-a-1')
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
