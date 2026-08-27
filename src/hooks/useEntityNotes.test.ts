/**
 * useEntityNotes — NOTITIE-PARITEIT regression tests. Two bugs fixed together
 * (heraudit w3fix-notes-parity, 27-08): (1) editNote must send `body` — the
 * task family's TaskCommentController::update validates `body`, not `text`,
 * so the pencil 422'd on every save; (2) the optimistic note must credit the
 * CURRENT logged-in user, never the record owner passed in by the caller
 * (mirrors useCandidateNotes/useApplicationNotes AUTHOR-1). §13: the request
 * itself is asserted (method/route/body), never only that a callback fired.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import api from '@/lib/api'
import { useEntityNotes } from './useEntityNotes'

const mockUseAuth = vi.fn(() => ({ user: { id: 'u1', name: 'Kelly Recruiter' } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return {
    ...actual,
    default: {
      get: vi.fn().mockResolvedValue({ data: { data: [] } }),
      post: vi.fn().mockResolvedValue({ data: {} }),
      patch: vi.fn().mockResolvedValue({ data: {} }),
      delete: vi.fn().mockResolvedValue({ data: {} }),
    },
  }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))

beforeEach(() => {
  vi.mocked(api.get).mockClear().mockResolvedValue({ data: { data: [] } })
  vi.mocked(api.post).mockClear().mockResolvedValue({ data: {} })
  vi.mocked(api.patch).mockClear().mockResolvedValue({ data: {} })
  mockUseAuth.mockReturnValue({ user: { id: 'u1', name: 'Kelly Recruiter' } } as never)
})

describe('useEntityNotes · editNote request body', () => {
  it('PATCHes the real route with `body` set (TaskCommentController validates body, not text)', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [{ id: 'n1', type: 'general', title: '', text: 'old', created_at: '2026-08-01T10:00:00Z' }] } })
    const { result } = renderHook(() => useEntityNotes({ id: 't1', basePath: '/tasks/t1' }))
    await act(async () => { await Promise.resolve() })
    act(() => { result.current.editNote(0, { type: 'general', title: 'New title', body: 'New text', language: 'nl' }) })
    expect(api.patch).toHaveBeenCalledWith('/tasks/t1/notes/n1', {
      type: 'general', title: 'New title', body: 'New text', text: 'New text', language: 'nl',
    })
  })

  it('skips the request for a still-optimistic note with no resolved id', () => {
    const { result } = renderHook(() => useEntityNotes({ id: 't1', basePath: '/tasks/t1' }))
    act(() => { result.current.editNote(0, { type: 'general', title: '', body: 'x' }) })
    expect(api.patch).not.toHaveBeenCalled()
  })
})

describe('useEntityNotes · addNote author (AUTHOR-CURRENT-USER-1)', () => {
  it('credits the optimistic note to the LOGGED-IN user, never the caller-passed record owner', () => {
    const { result } = renderHook(() => useEntityNotes({ id: 'm1', basePath: '/matches/m1' }))
    act(() => { result.current.addNote({ type: 'general', title: '', body: 'Belde de kandidaat' }) })
    expect(result.current.notes[0].author).toBe('Kelly Recruiter')
  })

  it('falls back to a Koios identity when no user is logged in', () => {
    mockUseAuth.mockReturnValue({ user: undefined } as never)
    const { result } = renderHook(() => useEntityNotes({ id: 'm1', basePath: '/matches/m1' }))
    act(() => { result.current.addNote({ type: 'general', title: '', body: 'Notitie' }) })
    expect(result.current.notes[0].author).toBe('')
  })

  it('refetches the list on a landed POST so the server-resolved id/author replaces the optimistic stand-in', async () => {
    const { result } = renderHook(() => useEntityNotes({ id: 'm1', basePath: '/matches/m1' }))
    await act(async () => { await Promise.resolve() })
    vi.mocked(api.get).mockClear()
    act(() => { result.current.addNote({ type: 'general', title: '', body: 'x' }) })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(api.get).toHaveBeenCalledWith('/matches/m1/notes')
  })
})
