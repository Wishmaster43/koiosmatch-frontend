/**
 * useCandidateNotes — LAST-CONTACT-REFRESH-1 (Danny 05-08): a note carrying a
 * contact channel stamps last_contact server-side (CandidateNote::booted →
 * recordContact, live-proven); the hook must then fire onContactStamped so the
 * caller refreshes its record — and must NOT fire it for a channel-less note.
 * §13: the POST itself is asserted (route + body), never only the callback.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { useCandidateNotes } from './useCandidateNotes'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: {
    get: vi.fn().mockResolvedValue({ data: { data: [] } }),
    post: vi.fn().mockResolvedValue({ data: { data: { id: 'n1' } } }),
    patch: vi.fn(), delete: vi.fn(),
  } }
})
vi.mock('@/lib/useNoteTypes', () => ({ useNoteTypes: () => ({ types: [], writableTypes: [] }), SYSTEM_NOTE_TYPES: [] }))
vi.mock('@/lib/useLastContactTypes', () => ({ useLastContactTypes: () => ({ types: [] }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v }) }))

beforeEach(() => { vi.mocked(api.post).mockClear(); vi.mocked(api.get).mockClear() })

describe('useCandidateNotes · onContactStamped (LAST-CONTACT-REFRESH-1)', () => {
  it('fires onContactStamped AFTER a successful save of a note WITH a channel', async () => {
    const onContactStamped = vi.fn()
    const { result } = renderHook(() => useCandidateNotes('c1', { onContactStamped }))
    act(() => { result.current.addNote({ type: 'general', title: '', body: 'Gebeld', channel: 'call' }) })
    // The POST carries the channel (the server stamps off it) …
    expect(api.post).toHaveBeenCalledWith('/candidates/c1/notes', { type: 'general', text: 'Gebeld', channel: 'call' })
    // … and only after it resolves does the refresh fire.
    await waitFor(() => expect(onContactStamped).toHaveBeenCalledTimes(1))
  })

  it('does NOT fire onContactStamped for an internal note without a channel', async () => {
    const onContactStamped = vi.fn()
    const { result } = renderHook(() => useCandidateNotes('c1', { onContactStamped }))
    act(() => { result.current.addNote({ type: 'general', title: '', body: 'Interne notitie' }) })
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
    await act(async () => { await Promise.resolve() })
    expect(onContactStamped).not.toHaveBeenCalled()
  })
})

// NOTE-TAAL-1 (06-08): the composer's picked language rides along on both
// writes — §13, assert the REQUEST body, never only that the call fired.
describe('useCandidateNotes · language (NOTE-TAAL-1)', () => {
  it('carries the picked language on addNote', async () => {
    const { result } = renderHook(() => useCandidateNotes('c1'))
    act(() => { result.current.addNote({ type: 'general', title: '', body: 'Notitie', language: 'en' }) })
    expect(api.post).toHaveBeenCalledWith('/candidates/c1/notes', { type: 'general', text: 'Notitie', channel: undefined, language: 'en' })
  })

  it('carries the picked language on editNote', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [{ id: 'n1', body: 'First' }] } })
    vi.mocked(api.patch).mockResolvedValueOnce({})
    const { result } = renderHook(() => useCandidateNotes('c1'))
    await waitFor(() => expect(result.current.notes).toHaveLength(1))
    act(() => { result.current.editNote(0, { type: 'general', title: '', body: 'Updated', language: 'de' }) })
    expect(api.patch).toHaveBeenCalledWith('/candidates/c1/notes/n1', { text: 'Updated', type: 'general', channel: undefined, language: 'de' })
  })

  it('omits language (undefined) when the recruiter never touched the picker', async () => {
    const { result } = renderHook(() => useCandidateNotes('c1'))
    act(() => { result.current.addNote({ type: 'general', title: '', body: 'Notitie' }) })
    // No `language` key set → the backend keeps its own tenant default.
    expect(api.post).toHaveBeenCalledWith('/candidates/c1/notes', expect.not.objectContaining({ language: expect.anything() }))
  })
})

// RECHTEN-DETAIL-1 (Danny 06-08 "notitie-eigenaarschap"): author_id is threaded
// through unchanged so the shared NotesTab can gate edit/delete on it (canManageNote).
describe('useCandidateNotes · author_id threading (RECHTEN-DETAIL-1)', () => {
  it('carries author_id from the GET response into the note state, own and legacy alike', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [
      { id: 'n1', body: 'Mine', author_id: 'u1' },
      { id: 'n2', body: 'Legacy', author_id: null },
    ] } })
    const { result } = renderHook(() => useCandidateNotes('c1'))
    await waitFor(() => expect(result.current.notes).toHaveLength(2))
    expect(result.current.notes[0].author_id).toBe('u1')
    expect(result.current.notes[1].author_id).toBeNull()
  })
})

// deleteNote (§13: assert the REQUEST, not just that a callback fired) — the route
// scopes the delete to the candidate, mirroring editNote's PATCH target.
describe('useCandidateNotes · deleteNote', () => {
  it('sends DELETE to the note\'s own route, keyed off the list index', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [
      { id: 'n1', body: 'First' }, { id: 'n2', body: 'Second' },
    ] } })
    vi.mocked(api.delete).mockResolvedValueOnce({})
    const { result } = renderHook(() => useCandidateNotes('c1'))
    await waitFor(() => expect(result.current.notes).toHaveLength(2))
    act(() => { result.current.deleteNote(1) })
    expect(api.delete).toHaveBeenCalledWith('/candidates/c1/notes/n2')
  })

  it('reverts the optimistic removal when the DELETE fails', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [{ id: 'n1', body: 'First' }] } })
    vi.mocked(api.delete).mockRejectedValueOnce(new Error('403'))
    const { result } = renderHook(() => useCandidateNotes('c1'))
    await waitFor(() => expect(result.current.notes).toHaveLength(1))
    act(() => { result.current.deleteNote(0) })
    // Optimistic removal happens synchronously …
    expect(result.current.notes).toHaveLength(0)
    // … then the rejected DELETE puts it back.
    await waitFor(() => expect(result.current.notes).toHaveLength(1))
  })
})

// BUG-HUNT-CLASS-B: a failed GET must be distinguishable from "no notes yet" —
// health-adjacent data, never a silent empty thread.
describe('useCandidateNotes · GET failure vs. genuine empty (Class B)', () => {
  it('flags error=true and does not claim loaded=false forever when the GET rejects', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('network'))
    const { result } = renderHook(() => useCandidateNotes('c1'))
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.error).toBe(true)
    expect(result.current.notes).toEqual([])
  })

  it('leaves error=false on a genuinely empty (but successful) GET', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    const { result } = renderHook(() => useCandidateNotes('c1'))
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.error).toBe(false)
    expect(result.current.notes).toEqual([])
  })

  it('reload() re-fires the GET and clears a previous error on success', async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ data: { data: [{ id: 'n1', body: 'Back' }] } })
    const { result } = renderHook(() => useCandidateNotes('c1'))
    await waitFor(() => expect(result.current.error).toBe(true))
    act(() => { result.current.reload() })
    await waitFor(() => expect(result.current.error).toBe(false))
    expect(result.current.notes).toHaveLength(1)
    expect(api.get).toHaveBeenCalledTimes(2)
  })
})
