/**
 * usePopoutCustomerNotes — asserts the exact REQUEST (§13): the rollup=1 list GET
 * and the add-note POST body/route, plus the optimistic-add-then-revert-on-failure
 * behaviour a recruiter relies on to never believe an unsent note was saved.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { usePopoutCustomerNotes } from './usePopoutCustomerNotes'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
const apiGet = api.get as unknown as ReturnType<typeof vi.fn>
const apiPost = api.post as unknown as ReturnType<typeof vi.fn>
const apiPatch = api.patch as unknown as ReturnType<typeof vi.fn>
const apiDelete = api.delete as unknown as ReturnType<typeof vi.fn>

describe('usePopoutCustomerNotes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads the rolled-up notes list on mount, mapped to the flat UI shape', async () => {
    apiGet.mockResolvedValue({ data: { data: [{ id: 'n1', type: 'general', body: 'Hello', created_at: '2026-08-01T10:00:00Z' }] } })
    const { result } = renderHook(() => usePopoutCustomerNotes('cust-1'))
    await waitFor(() => expect(result.current.notes).toHaveLength(1))
    expect(apiGet).toHaveBeenCalledWith('/customers/cust-1/notes', { params: { rollup: 1 } })
    expect(result.current.notes[0]).toMatchObject({ id: 'n1', type: 'general', text: 'Hello' })
  })

  it('never fetches without a customerId', () => {
    renderHook(() => usePopoutCustomerNotes(undefined))
    expect(apiGet).not.toHaveBeenCalled()
  })

  it('posts the exact add-note request and reloads the list on success', async () => {
    apiGet.mockResolvedValue({ data: { data: [] } })
    apiPost.mockResolvedValue({ data: { data: {} } })
    const { result } = renderHook(() => usePopoutCustomerNotes('cust-1'))
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1))

    act(() => { result.current.addNote({ type: 'general', title: '', body: 'A new note', language: 'nl' }) })
    // Optimistic prepend happens synchronously.
    expect(result.current.notes[0]).toMatchObject({ type: 'general', text: 'A new note' })
    expect(apiPost).toHaveBeenCalledWith('/customers/cust-1/notes', { type: 'general', text: 'A new note', language: 'nl' })
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2))
  })

  it('reverts the optimistic note and surfaces an error toast when the POST fails', async () => {
    apiGet.mockResolvedValue({ data: { data: [] } })
    apiPost.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => usePopoutCustomerNotes('cust-1'))
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1))

    act(() => { result.current.addNote({ type: 'general', title: '', body: 'Doomed note' }) })
    expect(result.current.notes).toHaveLength(1)
    await waitFor(() => expect(result.current.notes).toHaveLength(0))
    expect(notifyError).toHaveBeenCalledTimes(1)
  })
})

/**
 * K15NOTES — the popout window's edit/delete now exist alongside add. Asserts the
 * exact PATCH/DELETE route + body, index-based lookup, and revert-on-failure.
 */
describe('usePopoutCustomerNotes · editNote/deleteNote (K15NOTES)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('PATCHes the exact route + body for the note at that index', async () => {
    apiGet.mockResolvedValue({ data: { data: [{ id: 'n1', type: 'general', body: 'Origineel', created_at: '2026-08-01T10:00:00Z' }] } })
    apiPatch.mockResolvedValue({ data: { data: {} } })
    const { result } = renderHook(() => usePopoutCustomerNotes('cust-1'))
    await waitFor(() => expect(result.current.notes).toHaveLength(1))

    act(() => { result.current.editNote(0, { type: 'general', title: '', body: 'Bijgewerkt' }) })

    expect(apiPatch).toHaveBeenCalledWith('/customers/cust-1/notes/n1', { type: 'general', text: 'Bijgewerkt', language: undefined })
    expect(result.current.notes[0]).toMatchObject({ text: 'Bijgewerkt' })
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2)) // the post-edit reload
  })

  it('reverts the optimistic edit when the PATCH fails', async () => {
    apiGet.mockResolvedValue({ data: { data: [{ id: 'n1', type: 'general', body: 'Origineel', created_at: '2026-08-01T10:00:00Z' }] } })
    apiPatch.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => usePopoutCustomerNotes('cust-1'))
    await waitFor(() => expect(result.current.notes).toHaveLength(1))

    act(() => { result.current.editNote(0, { type: 'general', title: '', body: 'Bijgewerkt' }) })
    await waitFor(() => expect(notifyError).toHaveBeenCalled())

    expect(result.current.notes[0]).toMatchObject({ text: 'Origineel' })
  })

  it('DELETEs the exact route for the note at that index', async () => {
    apiGet.mockResolvedValue({ data: { data: [{ id: 'n1', type: 'general', body: 'Weg ermee', created_at: '2026-08-01T10:00:00Z' }] } })
    apiDelete.mockResolvedValue({})
    const { result } = renderHook(() => usePopoutCustomerNotes('cust-1'))
    await waitFor(() => expect(result.current.notes).toHaveLength(1))

    act(() => { result.current.deleteNote(0) })

    expect(apiDelete).toHaveBeenCalledWith('/customers/cust-1/notes/n1')
    expect(result.current.notes).toHaveLength(0)
  })

  it('reverts the optimistic delete when the DELETE fails', async () => {
    apiGet.mockResolvedValue({ data: { data: [{ id: 'n1', type: 'general', body: 'Blijft staan', created_at: '2026-08-01T10:00:00Z' }] } })
    apiDelete.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => usePopoutCustomerNotes('cust-1'))
    await waitFor(() => expect(result.current.notes).toHaveLength(1))

    act(() => { result.current.deleteNote(0) })
    await waitFor(() => expect(notifyError).toHaveBeenCalled())

    expect(result.current.notes).toHaveLength(1)
  })
})
