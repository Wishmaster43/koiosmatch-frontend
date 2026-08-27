/**
 * useOpportunityNotes — regression coverage for the optimistic-update bug class
 * (measured audit 2026-07-27): addNote used to `.then(load).catch(() => {})` — no
 * optimistic write and a fully swallowed error, so a rejected POST left no trace on
 * screen and no message; a recruiter had every reason to believe the note was
 * recorded and would not re-type it. Fixed to mirror the proven
 * useCandidateNotes.addNote pattern: optimistic prepend with a temp id, then reload
 * on success, and on failure remove that exact temp note + surface the server's own
 * message. Assert the SEAM (§13): the exact POST body, the optimistic write, and
 * the revert + notify on rejection.
 *
 * editNote coverage (OPP-NOTE-EDIT-1, CMBE golf 2a/2b, G23): PUT
 * /opportunities/{id}/notes/{note} {body, type?, language?} — assert the exact
 * PUT method/route/body (§13), the optimistic local update, and the revert +
 * notify on rejection, mirroring addNote's own three-case coverage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOpportunityNotes } from './useOpportunityNotes'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
// Minimal i18n stub (mirrors useWorkflowsData.test.ts) — the hook now calls
// useTranslation() directly to resolve the fallback error message.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

import api from '@/lib/api'
import { notifyError } from '@/lib/notify'

const mockedGet  = vi.mocked(api.get)
const mockedPost = vi.mocked(api.post)
const mockedPut  = vi.mocked(api.put)

beforeEach(() => { vi.clearAllMocks(); mockedGet.mockResolvedValue({ data: [] }) })

describe('useOpportunityNotes · addNote', () => {
  it('POSTs the payload, shows the note optimistically, then reloads on success', async () => {
    mockedPost.mockResolvedValue({})
    const { result } = renderHook(() => useOpportunityNotes('o1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.addNote({ type: 'internal', body: 'Klant gebeld' }) })
    expect(mockedPost).toHaveBeenCalledWith('/opportunities/o1/notes', { type: 'internal', body: 'Klant gebeld' })
    expect(result.current.items).toHaveLength(1) // optimistic
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2)) // reload after success
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('removes the failed note and surfaces the server message — never leaves a fake-saved note', async () => {
    mockedPost.mockRejectedValue({ response: { status: 500, data: { message: 'Server kon de notitie niet opslaan' } } })
    const { result } = renderHook(() => useOpportunityNotes('o1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.addNote({ type: 'internal', body: 'Zou verloren gaan' }) })
    expect(result.current.items).toHaveLength(1) // optimistic
    await waitFor(() => expect(result.current.items).toHaveLength(0)) // reverted — no fake trace
    expect(notifyError).toHaveBeenCalledWith('Server kon de notitie niet opslaan')
  })

  it('is a no-op for an empty body — never POSTs blank whitespace', async () => {
    const { result } = renderHook(() => useOpportunityNotes('o1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { result.current.addNote({ type: 'internal', body: '   ' }) })
    expect(mockedPost).not.toHaveBeenCalled()
  })
})

describe('useOpportunityNotes · editNote (OPP-NOTE-EDIT-1)', () => {
  it('PUTs the exact route + body, updates optimistically, then reloads on success', async () => {
    mockedGet.mockResolvedValueOnce({ data: [{ id: 'n1', type: 'internal', body: 'Origineel', author: 'Piet' }] })
    mockedPut.mockResolvedValue({})
    const { result } = renderHook(() => useOpportunityNotes('o1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toHaveLength(1)

    act(() => { result.current.editNote(0, { type: 'internal', body: 'Bewerkte tekst' }) })
    // Assert the REQUEST (§13): exact route + body — never only that the callback fired.
    expect(mockedPut).toHaveBeenCalledWith('/opportunities/o1/notes/n1', { type: 'internal', body: 'Bewerkte tekst' })
    expect(result.current.items[0].body).toBe('Bewerkte tekst') // optimistic
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2)) // reload after success
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('reverts the optimistic edit and surfaces the server message on rejection', async () => {
    mockedGet.mockResolvedValueOnce({ data: [{ id: 'n1', type: 'internal', body: 'Origineel', author: 'Piet' }] })
    mockedPut.mockRejectedValue({ response: { status: 500, data: { message: 'Kon de notitie niet bewerken' } } })
    const { result } = renderHook(() => useOpportunityNotes('o1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.editNote(0, { type: 'internal', body: 'Zou verloren gaan' }) })
    expect(result.current.items[0].body).toBe('Zou verloren gaan') // optimistic
    await waitFor(() => expect(result.current.items[0].body).toBe('Origineel')) // reverted
    expect(notifyError).toHaveBeenCalledWith('Kon de notitie niet bewerken')
  })

  it('is a no-op for an unknown index — never PUTs without a real target note', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] })
    const { result } = renderHook(() => useOpportunityNotes('o1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { result.current.editNote(0, { type: 'internal', body: 'Geen doel' }) })
    expect(mockedPut).not.toHaveBeenCalled()
  })
})

// NOTE-UNDO-FE-1 (K-172): the one-slot undo — pin the REQUEST (method + route),
// never only that a callback fired (§13).
describe('useOpportunityNotes · previous-version undo (NOTE-UNDO-FE-1)', () => {
  it('GETs the note\'s own previous-version route, keyed off the list index', async () => {
    mockedGet.mockResolvedValueOnce({ data: [{ id: 'n1', body: 'First' }] })
    mockedGet.mockResolvedValueOnce({ data: { data: { previous_body: '<p>Oud</p>', previous_saved_at: '2026-08-20T10:00:00Z' } } })
    const { result } = renderHook(() => useOpportunityNotes('o1'))
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    const preview = await act(() => result.current.fetchPreviousVersion(0))
    expect(mockedGet).toHaveBeenCalledWith('/opportunities/o1/notes/n1/previous-version')
    expect(preview).toEqual({ previous_body: '<p>Oud</p>', previous_saved_at: '2026-08-20T10:00:00Z' })
  })

  it('resolves null (never throws) when the peek 422s — no slot yet', async () => {
    mockedGet.mockResolvedValueOnce({ data: [{ id: 'n1', body: 'First' }] })
    mockedGet.mockRejectedValueOnce({ response: { status: 422 } })
    const { result } = renderHook(() => useOpportunityNotes('o1'))
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    const preview = await act(() => result.current.fetchPreviousVersion(0))
    expect(preview).toBeNull()
  })

  it('POSTs restore-previous to the note\'s own route and reloads the thread on success', async () => {
    mockedGet.mockResolvedValueOnce({ data: [{ id: 'n1', body: 'First' }] })
    mockedGet.mockResolvedValueOnce({ data: [{ id: 'n1', body: 'Restored', has_previous_version: false }] })
    mockedPost.mockResolvedValueOnce({ data: { data: { id: 'n1', body: 'Restored' } } })
    const { result } = renderHook(() => useOpportunityNotes('o1'))
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    const landed = await act(() => result.current.restorePreviousVersion(0))
    expect(mockedPost).toHaveBeenCalledWith('/opportunities/o1/notes/n1/restore-previous')
    expect(landed).toBe(true)
    await waitFor(() => expect(result.current.items[0].body).toBe('Restored'))
  })

  it('resolves false (never throws) when the restore 422s — the guard rejected it', async () => {
    mockedGet.mockResolvedValueOnce({ data: [{ id: 'n1', body: 'First' }] })
    mockedPost.mockRejectedValueOnce({ response: { status: 422 } })
    const { result } = renderHook(() => useOpportunityNotes('o1'))
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    const landed = await act(() => result.current.restorePreviousVersion(0))
    expect(landed).toBe(false)
  })
})
