/**
 * CandidateNotesPopout — the four UI states (§3): loading skeleton, error+retry,
 * success (header + shared NotesTab), and the document.title bootstrap/restore.
 * Mirrors CommunicationTab.test.tsx's mocking convention for the note-type/
 * last-contact lookups so this stays a focused test of THIS page's own wiring.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CandidateNotesPopout from './CandidateNotesPopout'

// NotesTab pulls in `@/lib/datetime`, which side-effect-imports the real i18n
// bootstrap (`src/i18n`) for LOCALE_BY_LANG — mocked here so this test, like
// CommunicationTab.test.tsx, stays on react-i18next's key-fallback behaviour
// (no real translation resources loaded) instead of rendering real Dutch copy.
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v, locale: 'nl-NL' }) }))
vi.mock('@/lib/useNoteTypes', () => ({ useNoteTypes: () => ({ types: [], writableTypes: [] }), SYSTEM_NOTE_TYPES: new Set() }))
vi.mock('@/lib/useLastContactTypes', () => ({ useLastContactTypes: () => ({ types: [] }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => false }) }))
vi.mock('@/pages/candidates/hooks/useCandidateNotes', () => ({
  useCandidateNotes: () => ({ notes: [], addNote: vi.fn(), editNote: vi.fn(), deleteNote: vi.fn() }),
}))

// Mutable per-test candidate-lite state (vi.hoisted so the mock factory can read it).
const { liteState } = vi.hoisted(() => ({
  liteState: { candidate: null as { id: string; name: string; initials: string } | null, loading: false, error: false, reload: vi.fn() },
}))
vi.mock('./hooks/useCandidateLite', () => ({ useCandidateLite: () => liteState }))

describe('CandidateNotesPopout', () => {
  const previousTitle = document.title
  beforeEach(() => {
    liteState.candidate = null
    liteState.loading = false
    liteState.error = false
    liteState.reload = vi.fn()
  })
  afterEach(() => { document.title = previousTitle })

  it('shows a loading skeleton while the candidate identity loads', () => {
    liteState.loading = true
    render(<CandidateNotesPopout id="cand-1" />)
    expect(screen.getByText('common:loading')).toBeInTheDocument()
  })

  it('shows an error row with a working retry when the candidate fails to load', async () => {
    const user = userEvent.setup()
    liteState.error = true
    render(<CandidateNotesPopout id="cand-1" />)
    expect(screen.getByText('popout.loadError')).toBeInTheDocument()
    await user.click(screen.getByText('common:error.retry'))
    expect(liteState.reload).toHaveBeenCalledTimes(1)
  })

  it('renders the candidate name + the shared notes surface on success', () => {
    liteState.candidate = { id: 'cand-1', name: 'Anne de Vries', initials: 'AD' }
    render(<CandidateNotesPopout id="cand-1" />)
    expect(screen.getByText('Anne de Vries')).toBeInTheDocument()
    // The shared NotesTab's own empty-state copy proves it actually mounted.
    expect(screen.getByText('sections.notesEmpty')).toBeInTheDocument()
  })

  it('sets the window title to the candidate popout title and restores it on unmount', () => {
    liteState.candidate = { id: 'cand-1', name: 'Anne de Vries', initials: 'AD' }
    const { unmount } = render(<CandidateNotesPopout id="cand-1" />)
    expect(document.title).toBe('popout.windowTitle')
    unmount()
    expect(document.title).toBe(previousTitle)
  })
})
