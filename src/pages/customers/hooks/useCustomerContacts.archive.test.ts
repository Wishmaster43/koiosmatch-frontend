/** useCustomerContacts · archive and restore (split from useCustomerContacts.test.ts; same mocks). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import {
  CONTACTS_CHANGED_EVENT, archiveContact, restoreContact, useArchivedCustomerContacts,
} from './useCustomerContacts'

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

beforeEach(() => { mockGet.mockReset(); mockPost.mockReset() })

/**
 * ARCHIVE-SUBENTITY-1 — the reversible soft-delete pair. Standalone functions
 * (not hook-returned callbacks), mirroring setLocationPrimaryContact (see useCustomerContacts.primary.test.ts) —
 * fired from deep inside ContactDetail, several hops from this hook's owner.
 */
describe('useCustomerContacts · archiveContact / restoreContact (ARCHIVE-SUBENTITY-1)', () => {
  it('archiveContact POSTs the archive route and dispatches CONTACTS_CHANGED_EVENT', async () => {
    mockPost.mockResolvedValue({ data: {} })
    const onChanged = vi.fn()
    window.addEventListener(CONTACTS_CHANGED_EVENT, onChanged)

    await archiveContact('cust1', 'c1')

    expect(mockPost).toHaveBeenCalledWith('/customers/cust1/contacts/c1/archive', undefined,
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    expect(onChanged).toHaveBeenCalledTimes(1)
    window.removeEventListener(CONTACTS_CHANGED_EVENT, onChanged)
  })

  it('restoreContact POSTs the restore route, dispatches the event and returns the mapped contact', async () => {
    mockPost.mockResolvedValue({ data: { data: { id: 'c1', first_name: 'Jill', last_name: 'A', archived: false } } })
    const onChanged = vi.fn()
    window.addEventListener(CONTACTS_CHANGED_EVENT, onChanged)

    const restored = await restoreContact('cust1', 'c1')

    expect(mockPost).toHaveBeenCalledWith('/customers/cust1/contacts/c1/restore', undefined,
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
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
