/**
 * useApplicationNotes — AUTHOR-1 (07-08): the optimistic note must credit the
 * LOGGED-IN user, never the application's assigned owner. TIMESTAMP-1: seeded
 * notes re-key `time` → `created_at` (what the shared NotesTab reads). §13: the
 * POST request itself is asserted (route + body), never only that a callback fired.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import api from '@/lib/api'
import { useApplicationNotes } from './useApplicationNotes'
import type { ApplicationDetail } from '@/types/application'

const mockUseAuth = vi.fn(() => ({ user: { id: 'u9', name: 'Kelly Recruiter' } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { post: vi.fn().mockResolvedValue({ data: {} }) } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))

beforeEach(() => { vi.mocked(api.post).mockClear(); mockUseAuth.mockReturnValue({ user: { id: 'u9', name: 'Kelly Recruiter' } }) })

describe('useApplicationNotes · addNote author (AUTHOR-1)', () => {
  it('credits the optimistic note to the LOGGED-IN user, not the application owner', () => {
    const { result } = renderHook(() => useApplicationNotes('app1', []))
    act(() => { result.current.addNote({ type: 'general', title: '', body: 'Belde de kandidaat' }) })
    expect(result.current.notes[0].author).toBe('Kelly Recruiter')
    expect(result.current.notes[0].author_id).toBe('u9')
  })

  it('falls back to a Koios identity when no user is logged in', () => {
    mockUseAuth.mockReturnValue({ user: undefined } as never)
    const { result } = renderHook(() => useApplicationNotes('app1', []))
    act(() => { result.current.addNote({ type: 'general', title: '', body: 'Notitie' }) })
    expect(result.current.notes[0].author).toBe('Koios')
    expect(result.current.notes[0].author_id).toBeNull()
  })

  it('POSTs the real request to the application notes route with type/title/body/language', () => {
    const { result } = renderHook(() => useApplicationNotes('app1', []))
    act(() => { result.current.addNote({ type: 'general', title: 'Kort', body: 'Tekst', language: 'nl' }) })
    expect(api.post).toHaveBeenCalledWith('/applications/app1/notes', { type: 'general', title: 'Kort', body: 'Tekst', language: 'nl' })
  })

  it('removes the optimistic note again when the save fails (OPTIMISTIC-REVERT-1 parity)', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 422 } })
    const { result } = renderHook(() => useApplicationNotes('app1', []))
    act(() => { result.current.addNote({ type: 'general', title: '', body: 'Mislukt' }) })
    expect(result.current.notes).toHaveLength(1)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(result.current.notes).toHaveLength(0)
  })

  it('does nothing when no applicationId is present', () => {
    const { result } = renderHook(() => useApplicationNotes(undefined, []))
    act(() => { result.current.addNote({ type: 'general', title: '', body: 'x' }) })
    expect(result.current.notes).toHaveLength(0)
    expect(api.post).not.toHaveBeenCalled()
  })
})

// TIMESTAMP-1 (07-08): mapApplicationDetail's notes carry the date under `time`;
// the shared NotesTab reads `created_at` — seeding must re-key it, once, here.
describe('useApplicationNotes · seeding (TIMESTAMP-1)', () => {
  it('re-keys `time` to `created_at` for every seeded note', () => {
    const initial: ApplicationDetail['notes'] = [
      { id: 'n1', author: 'Bente de Jong', authorId: null, type: 'general', title: '', text: 'Eerder', language: '', time: '2026-08-01T09:00:00Z' },
    ]
    const { result } = renderHook(() => useApplicationNotes('app1', initial))
    expect(result.current.notes[0].created_at).toBe('2026-08-01T09:00:00Z')
    expect(result.current.notes[0].author).toBe('Bente de Jong')
  })
})

// NOTE-AUTHOR-SHAPE-2 (verified live 2026-08-07, CMBE 5961c673): a fetched note now
// carries a real `authorId` (mapApplicationDetail) — seeding must re-key it to
// `author_id`, the key the shared NotesTab's canManageNote() rights gate reads. It
// used to be dropped entirely here, which left every seeded note's `author_id`
// `undefined` — the gate's permissive "not migrated" default, engaging for nobody.
describe('useApplicationNotes · seeding thread the real author_id (NOTE-AUTHOR-SHAPE-2)', () => {
  it('re-keys `authorId` to `author_id` for a seeded note authored by someone else', () => {
    const initial: ApplicationDetail['notes'] = [
      { id: 'n2', author: 'Bente de Jong', authorId: 'u1', type: 'general', title: '', text: 'Collega-notitie', language: '', time: '2026-08-06T09:00:00Z' },
    ]
    const { result } = renderHook(() => useApplicationNotes('app1', initial))
    expect(result.current.notes[0].author_id).toBe('u1')
  })

  it('seeds author_id as null (never undefined) when the resource sent no author at all', () => {
    const initial: ApplicationDetail['notes'] = [
      { id: 'n3', author: '', authorId: null, type: 'general', title: '', text: 'Legacy', language: '', time: '2026-08-06T09:00:00Z' },
    ]
    const { result } = renderHook(() => useApplicationNotes('app1', initial))
    expect(result.current.notes[0].author_id).toBeNull()
  })
})
