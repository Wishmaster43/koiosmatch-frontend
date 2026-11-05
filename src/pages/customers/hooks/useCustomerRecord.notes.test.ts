/** useCustomerRecord · note add, edit, delete and previous-version undo (split from useCustomerRecord.test.ts; the selection and update tests stay there). */
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

import { customer } from './useCustomerRecord.testKit'

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

    expect(mockedPatch).toHaveBeenCalledWith('/customers/1/notes/n-1', { type: 'general', title: '', text: 'Bijgewerkt', language: undefined })
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

/**
 * NOTE-UNDO-FE-1 (K-172) — the one-slot undo. Asserts the REQUEST (§13): the
 * exact GET/POST route, never only that a callback fired.
 */
describe('useCustomerRecord · previous-version undo (NOTE-UNDO-FE-1)', () => {
  const withNote = customer({
    id: 1,
    notes: [{ id: 'n-1', type: 'general', title: '', text: 'Origineel', ago: '', contactId: null, contactName: '', locationId: null, locationName: '', departmentId: null, departmentName: '' }],
  })

  it('GETs the note\'s own previous-version route', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: { previous_body: '<p>Oud</p>', previous_saved_at: '2026-08-20T10:00:00Z' } } })
    const r = harness([withNote])
    const preview = await act(() => r.result.current.record.fetchPreviousVersion(1, 'n-1'))
    expect(vi.mocked(api.get)).toHaveBeenCalledWith('/customers/1/notes/n-1/previous-version')
    expect(preview).toEqual({ previous_body: '<p>Oud</p>', previous_saved_at: '2026-08-20T10:00:00Z' })
  })

  it('resolves null (never throws) when the peek 422s', async () => {
    vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 422 } })
    const r = harness([withNote])
    const preview = await act(() => r.result.current.record.fetchPreviousVersion(1, 'n-1'))
    expect(preview).toBeNull()
  })

  it('POSTs restore-previous to the note\'s own route and updates the note in place on success', async () => {
    mockedGet.mockResolvedValue({ data: withNote })
    // The REAL CustomerNoteResource shape: snake_case with `body` — never `text`.
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { id: 'n-1', type: 'general', body: '<p>Restored</p>', created_at: '2026-08-24', has_previous_version: true } } })
    const r = harness([withNote])
    act(() => { r.result.current.record.selectCustomer(withNote) })
    await waitFor(() => expect(r.result.current.record.detail?.id).toBe(1))

    const landed = await act(() => r.result.current.record.restorePreviousVersion(1, 'n-1'))

    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/customers/1/notes/n-1/restore-previous', undefined,
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    expect(landed).toBe(true)
    expect(r.result.current.record.detail?.notes?.[0]).toMatchObject({ id: 'n-1', text: '<p>Restored</p>', has_previous_version: true })
  })

  it('resolves false (never throws) when the restore 422s', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 422 } })
    const r = harness([withNote])
    const landed = await act(() => r.result.current.record.restorePreviousVersion(1, 'n-1'))
    expect(landed).toBe(false)
  })
})
