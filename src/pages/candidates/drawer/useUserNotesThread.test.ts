/**
 * useUserNotesThread — shared by CommunicationTab's Notities sub-tab and the
 * second-screen CandidateNotesPopout window (DRY round 11, CANDTABS). Asserts
 * the filtered-index remap (the exact bug class NOTITIE-POPOUT-EDIT-1 guards
 * end-to-end in CandidateNotesPopout.test.tsx) and the optional undo wrappers.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { candidateNoteLabels, useUserNotesThread } from './useUserNotesThread'
import type { CandidateNote } from '../hooks/useCandidateNotes'

// One flag-driven system note (is_system) and one type-driven system note
// (SYSTEM_NOTE_TYPES, real 'status_change'/'lifecycle' set) — both must be
// filtered out, exercising the isSystemNote OR.
const notes: CandidateNote[] = [
  { id: 'n0', type: 'other', is_system: true },
  { id: 'n1', type: 'note' },
  { id: 'n2', type: 'status_change' },
  { id: 'n3', type: 'note' },
]

describe('useUserNotesThread', () => {
  it('splits system notes (is_system flag OR SYSTEM_NOTE_TYPES) out of the user thread', () => {
    const { result } = renderHook(() => useUserNotesThread(notes, { editNote: vi.fn(), deleteNote: vi.fn() }))
    expect(result.current.userNotes.map(n => n.id)).toEqual(['n1', 'n3'])
    expect(result.current.systemNotes.map(n => n.id)).toEqual(['n0', 'n2'])
  })

  it('remaps a filtered user-list index back to the full-thread index on edit', () => {
    const editNote = vi.fn()
    const { result } = renderHook(() => useUserNotesThread(notes, { editNote, deleteNote: vi.fn() }))
    // userNotes[1] is n3, the full-thread index 3.
    result.current.editUserNote(1, { type: 'note', title: '', body: 'edited' })
    expect(editNote).toHaveBeenCalledWith(3, { type: 'note', title: '', body: 'edited' })
  })

  it('remaps a filtered user-list index back to the full-thread index on delete', () => {
    const deleteNote = vi.fn()
    const { result } = renderHook(() => useUserNotesThread(notes, { editNote: vi.fn(), deleteNote }))
    // userNotes[0] is n1, the full-thread index 1.
    result.current.deleteUserNote(0)
    expect(deleteNote).toHaveBeenCalledWith(1)
  })

  it('omits the undo wrappers entirely when the caller passes no fetch/restore (mirrors CandidateNotesPopout, which has no undo)', () => {
    const { result } = renderHook(() => useUserNotesThread(notes, { editNote: vi.fn(), deleteNote: vi.fn() }))
    expect(result.current.fetchUserPreviousVersion).toBeUndefined()
    expect(result.current.restoreUserPreviousVersion).toBeUndefined()
  })

  it('remaps the same filtered index through fetch/restore when the caller does pass them (mirrors CommunicationTab)', () => {
    const fetchPreviousVersion = vi.fn()
    const restorePreviousVersion = vi.fn()
    const { result } = renderHook(() => useUserNotesThread(notes, {
      editNote: vi.fn(), deleteNote: vi.fn(), fetchPreviousVersion, restorePreviousVersion,
    }))
    result.current.fetchUserPreviousVersion?.(1)
    result.current.restoreUserPreviousVersion?.(1)
    expect(fetchPreviousVersion).toHaveBeenCalledWith(3)
    expect(restorePreviousVersion).toHaveBeenCalledWith(3)
  })
})

describe('candidateNoteLabels', () => {
  it('resolves the shared label subset through the caller\'s own t()', () => {
    const t = (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key)
    const labels = candidateNoteLabels(t as never)
    expect(labels.notes).toBe('')
    expect(labels.newNote).toBe('communication.newNote')
    expect(labels.notePlaceholder('Telefoon')).toBe('communication.notePlaceholder:{"type":"Telefoon"}')
  })
})
