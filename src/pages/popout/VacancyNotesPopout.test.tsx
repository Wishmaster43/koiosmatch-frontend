/**
 * VacancyNotesPopout — the four UI states (§3): loading skeleton, error+retry,
 * success (header + shared NotesTab), and the document.title bootstrap/restore.
 * Mirrors CandidateNotesPopout.test.tsx's mocking convention.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VacancyNotesPopout from './VacancyNotesPopout'

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v, formatTime: (v: string) => v, locale: 'nl-NL' }) }))
vi.mock('@/lib/useNoteTypes', () => ({ useNoteTypes: () => ({ types: [], writableTypes: [] }), SYSTEM_NOTE_TYPES: new Set() }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Koios' }, hasPermission: () => false }) }))
vi.mock('./hooks/usePopoutVacancyNotes', () => ({ usePopoutVacancyNotes: () => ({ notes: [], addNote: vi.fn() }) }))

// Mutable per-test vacancy-lite state (vi.hoisted so the mock factory can read it).
const { liteState } = vi.hoisted(() => ({
  liteState: { vacancy: null as { id: string; name: string; initials: string } | null, loading: false, error: false, reload: vi.fn() },
}))
vi.mock('./hooks/useVacancyLite', () => ({ useVacancyLite: () => liteState }))

describe('VacancyNotesPopout', () => {
  const previousTitle = document.title
  beforeEach(() => {
    liteState.vacancy = null
    liteState.loading = false
    liteState.error = false
    liteState.reload = vi.fn()
  })
  afterEach(() => { document.title = previousTitle })

  it('shows a loading skeleton while the vacancy identity loads', () => {
    liteState.loading = true
    render(<VacancyNotesPopout id="vac-1" />)
    expect(screen.getByText('common:loading')).toBeInTheDocument()
  })

  it('shows an error row with a working retry when the vacancy fails to load', async () => {
    const user = userEvent.setup()
    liteState.error = true
    render(<VacancyNotesPopout id="vac-1" />)
    expect(screen.getByText('popout.loadError')).toBeInTheDocument()
    await user.click(screen.getByText('common:error.retry'))
    expect(liteState.reload).toHaveBeenCalledTimes(1)
  })

  it('does not repeat the vacancy name in the notes header, and mounts the shared notes surface', () => {
    liteState.vacancy = { id: 'vac-1', name: 'Verzorgende IG', initials: 'VI' }
    render(<VacancyNotesPopout id="vac-1" />)
    // VAC-NOTES-CALM-1: the drawer/window title already names the vacancy —
    // the in-page header must not repeat it (mirrors the candidate profile-text
    // block, which only ever labels the SECTION, never the entity).
    expect(screen.queryByText('Verzorgende IG')).not.toBeInTheDocument()
    // The calm section label ("Notes") still identifies the surface.
    expect(screen.getByText('notes.title')).toBeInTheDocument()
    // The shared NotesTab's own empty-state copy proves it actually mounted.
    expect(screen.getByText('notes.empty')).toBeInTheDocument()
  })

  it('sets the window title to the vacancy popout title and restores it on unmount', () => {
    liteState.vacancy = { id: 'vac-1', name: 'Verzorgende IG', initials: 'VI' }
    const { unmount } = render(<VacancyNotesPopout id="vac-1" />)
    expect(document.title).toBe('popout.windowTitle')
    unmount()
    expect(document.title).toBe(previousTitle)
  })
})
