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

beforeEach(() => { vi.mocked(api.post).mockClear() })

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
