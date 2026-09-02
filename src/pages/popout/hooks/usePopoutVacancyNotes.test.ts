/**
 * usePopoutVacancyNotes — asserts the exact REQUEST (§13): the notes-list GET on
 * mount and the add-note POST body/route (no title-stripping, mirrors
 * vacancies/drawer/NotesTab.tsx), plus optimistic-add-then-revert on failure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { usePopoutVacancyNotes } from './usePopoutVacancyNotes'

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

describe('usePopoutVacancyNotes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads the notes list on mount', async () => {
    apiGet.mockResolvedValue({ data: { data: [{ id: 'n1', type: 'general', body: 'Hello', author: 'Anne' }] } })
    const { result } = renderHook(() => usePopoutVacancyNotes('vac-1', 'Koios'))
    await waitFor(() => expect(result.current.notes).toHaveLength(1))
    expect(apiGet).toHaveBeenCalledWith('/vacancies/vac-1/notes')
  })

  it('never fetches without a vacancyId', () => {
    renderHook(() => usePopoutVacancyNotes(undefined, 'Koios'))
    expect(apiGet).not.toHaveBeenCalled()
  })

  it('posts the exact add-note request (payload forwarded as-is) and reloads on success', async () => {
    apiGet.mockResolvedValue({ data: { data: [] } })
    apiPost.mockResolvedValue({ data: { data: {} } })
    const { result } = renderHook(() => usePopoutVacancyNotes('vac-1', 'Koios'))
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1))

    act(() => { result.current.addNote({ type: 'general', title: 'x', body: 'A new note', language: 'nl' }) })
    // Optimistic prepend, authored locally by the passed authorName.
    expect(result.current.notes[0]).toMatchObject({ type: 'general', text: 'A new note', author: 'Koios' })
    expect(apiPost).toHaveBeenCalledWith('/vacancies/vac-1/notes', { type: 'general', title: 'x', body: 'A new note', language: 'nl' })
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2))
  })

  it('reverts the optimistic note and surfaces an error toast when the POST fails', async () => {
    apiGet.mockResolvedValue({ data: { data: [] } })
    apiPost.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => usePopoutVacancyNotes('vac-1', 'Koios'))
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1))

    act(() => { result.current.addNote({ type: 'general', title: '', body: 'Doomed note' }) })
    expect(result.current.notes).toHaveLength(1)
    await waitFor(() => expect(result.current.notes).toHaveLength(0))
    expect(notifyError).toHaveBeenCalledTimes(1)
  })

  // NOTITIE-POPOUT-1 FE-restje (Danny 02-09 "A ja"): the vacancy popout page can
  // now edit and delete like the customer one — assert the REQUEST (§13).
  it('PATCHes the exact edit request (drawer payload shape) and resolves true on a landed write', async () => {
    apiGet.mockResolvedValue({ data: { data: [{ id: 'n1', type: 'general', body: 'Old', text: 'Old', author: 'Anne' }] } })
    apiPatch.mockResolvedValue({ data: { data: {} } })
    const { result } = renderHook(() => usePopoutVacancyNotes('vac-1', 'Koios'))
    await waitFor(() => expect(result.current.notes).toHaveLength(1))

    let ok = false
    await act(async () => { ok = await result.current.editNote(0, { type: 'call', title: '', body: 'New text', language: 'nl' }) })
    expect(ok).toBe(true)
    expect(apiPatch).toHaveBeenCalledWith('/vacancies/vac-1/notes/n1', { type: 'call', title: '', body: 'New text', language: 'nl', text: 'New text' })
  })

  it('DELETEs the exact note route and removes the row optimistically', async () => {
    apiGet.mockResolvedValue({ data: { data: [{ id: 'n1', type: 'general', body: 'Old', text: 'Old', author: 'Anne' }] } })
    apiDelete.mockResolvedValue({ data: {} })
    const { result } = renderHook(() => usePopoutVacancyNotes('vac-1', 'Koios'))
    await waitFor(() => expect(result.current.notes).toHaveLength(1))

    act(() => { result.current.deleteNote(0) })
    expect(result.current.notes).toHaveLength(0)
    expect(apiDelete).toHaveBeenCalledWith('/vacancies/vac-1/notes/n1')
  })
})
