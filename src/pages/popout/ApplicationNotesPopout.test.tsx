/**
 * ApplicationNotesPopout — A-popout-1: the four UI states (§3): loading
 * skeleton, error+retry, success (header + shared NotesTab), and the
 * document.title bootstrap/restore. Mirrors VacancyNotesPopout.test.tsx's
 * mocking convention.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApplicationNotesPopout from './ApplicationNotesPopout'

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v, locale: 'nl-NL' }) }))
vi.mock('@/lib/useNoteTypes', () => ({ useNoteTypes: () => ({ types: [], writableTypes: [] }), SYSTEM_NOTE_TYPES: new Set() }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Koios' }, hasPermission: () => false }) }))
const mockEditNote = vi.fn()
const { notesState } = vi.hoisted(() => ({ notesState: { notes: [] as Array<{ id: string; text: string; type: string }> } }))
vi.mock('./hooks/usePopoutApplicationNotes', () => ({
  usePopoutApplicationNotes: () => ({ notes: notesState.notes, addNote: vi.fn(), editNote: mockEditNote }),
}))

// Mutable per-test application-lite state (vi.hoisted so the mock factory can read it).
const { liteState } = vi.hoisted(() => ({
  liteState: { application: null as { id: string; candidateName: string; vacancyTitle: string; initials: string } | null, loading: false, error: false, reload: vi.fn() },
}))
vi.mock('./hooks/useApplicationLite', () => ({ useApplicationLite: () => liteState }))

describe('ApplicationNotesPopout', () => {
  const previousTitle = document.title
  beforeEach(() => {
    liteState.application = null
    liteState.loading = false
    liteState.error = false
    liteState.reload = vi.fn()
    notesState.notes = []
    mockEditNote.mockReset()
  })
  afterEach(() => { document.title = previousTitle })

  it('shows a loading skeleton while the application identity loads', () => {
    liteState.loading = true
    render(<ApplicationNotesPopout id="app-1" />)
    expect(screen.getByText('common:loading')).toBeInTheDocument()
  })

  it('shows an error row with a working retry when the application fails to load', async () => {
    const user = userEvent.setup()
    liteState.error = true
    render(<ApplicationNotesPopout id="app-1" />)
    expect(screen.getByText('common:popout.loadError')).toBeInTheDocument()
    await user.click(screen.getByText('common:error.retry'))
    expect(liteState.reload).toHaveBeenCalledTimes(1)
  })

  it('renders the candidate name + the shared notes surface on success', () => {
    liteState.application = { id: 'app-1', candidateName: 'Jamie Bakker', vacancyTitle: 'Verzorgende IG', initials: 'JB' }
    render(<ApplicationNotesPopout id="app-1" />)
    expect(screen.getByText('Jamie Bakker')).toBeInTheDocument()
    // The shared NotesTab's own empty-state copy proves it actually mounted.
    expect(screen.getByText('notes.empty')).toBeInTheDocument()
  })

  it('sets the window title to the generic popout title and restores it on unmount', () => {
    liteState.application = { id: 'app-1', candidateName: 'Jamie Bakker', vacancyTitle: 'Verzorgende IG', initials: 'JB' }
    const { unmount } = render(<ApplicationNotesPopout id="app-1" />)
    expect(document.title).toBe('common:popout.windowTitle')
    unmount()
    expect(document.title).toBe(previousTitle)
  })

  // A-popout-1: PATCH /applications/{id}/notes/{note} now exists — this window
  // must really wire onEditNote (unlike the vacancy popout, add-only) — assert
  // the actual editNote(index, payload) call, not just that a click fired (§13).
  it('edits an existing note through the wired onEditNote', async () => {
    const user = userEvent.setup()
    liteState.application = { id: 'app-1', candidateName: 'Jamie Bakker', vacancyTitle: '', initials: 'JB' }
    notesState.notes = [{ id: 'n1', text: 'Original note', type: '' }]
    render(<ApplicationNotesPopout id="app-1" />)
    await user.click(screen.getByRole('button', { name: 'common:edit' }))
    await user.click(screen.getByRole('button', { name: 'notes.save' }))
    expect(mockEditNote).toHaveBeenCalledWith(0, expect.objectContaining({ body: 'Original note' }))
  })
})
