/**
 * NoteEditPopout — NOTITIE-POPOUT-URL-1: one existing note in a window of its
 * own, addressed by URL. Pins the four states (§3), the rights gate on a
 * pasteable URL, and the SEAM (§13): saving must resolve the note by the URL's
 * id and hand the edited payload to the hook's editNote at that exact index.
 * Mocking convention mirrors CandidateNotesPopout.test.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import NoteEditPopout from './NoteEditPopout'

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v, locale: 'nl-NL' }) }))
vi.mock('@/lib/useNoteTypes', () => ({
  useNoteTypes: () => ({ types: [{ value: 'general', label: 'Algemeen' }], writableTypes: [{ value: 'general', label: 'Algemeen' }] }),
  SYSTEM_NOTE_TYPES: new Set(['status_change']),
}))
vi.mock('@/lib/useLastContactTypes', () => ({ useLastContactTypes: () => ({ types: [] }) }))
// Rights: u1 is logged in with no manage_all — own notes only (noteRights).
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' }, hasPermission: () => false }) }))
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea aria-label="body" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))
// The Koios assist section is out of scope for this page test.
vi.mock('@/components/drawer/tabs/notes/NoteAssistSection', () => ({ default: () => null }))

const { notesState } = vi.hoisted(() => ({
  notesState: {
    notes: [] as Array<Record<string, unknown>>,
    loaded: true,
    addNote: vi.fn(), editNote: vi.fn(), deleteNote: vi.fn(),
  },
}))
vi.mock('@/pages/candidates/hooks/useCandidateNotes', () => ({ useCandidateNotes: () => notesState }))

const { liteState } = vi.hoisted(() => ({
  liteState: { candidate: null as { id: string; name: string; initials: string } | null, loading: false, error: false, reload: vi.fn() },
}))
vi.mock('./hooks/useCandidateLite', () => ({ useCandidateLite: () => liteState }))

// Mount on the REAL route shape so useParams carries entity/id/noteId like production.
const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/popout/notes/:entity/:id/:noteId" element={<NoteEditPopout />} /></Routes>
  </MemoryRouter>,
)

describe('NoteEditPopout · NOTITIE-POPOUT-URL-1', () => {
  const previousTitle = document.title
  beforeEach(() => {
    // jsdom's real window.close() tears the document down mid-suite — stub it.
    vi.spyOn(window, 'close').mockImplementation(() => {})
    liteState.candidate = { id: 'c1', name: 'Yara Groen', initials: 'YG' }
    liteState.loading = false
    liteState.error = false
    liteState.reload = vi.fn()
    notesState.loaded = true
    notesState.notes = [
      { id: 'n1', type: 'general', body: '<p>Eerste</p>', author_id: 'u1' },
      { id: 'n2', type: 'general', body: '<p>Tweede</p>', author_id: 'u1' },
    ]
    notesState.editNote = vi.fn().mockResolvedValue(true)
  })
  afterEach(() => { document.title = previousTitle; vi.restoreAllMocks() })

  it('renders the candidate name and THAT note\'s text in the editor', () => {
    renderAt('/popout/notes/candidate/c1/n2')
    expect(screen.getByText('Yara Groen')).toBeInTheDocument()
    expect(screen.getByLabelText('body')).toHaveValue('<p>Tweede</p>')
  })

  it('saves through editNote at the URL-resolved index — the seam (§13)', async () => {
    const user = userEvent.setup()
    renderAt('/popout/notes/candidate/c1/n2')
    await user.type(screen.getByLabelText('body'), ' extra')
    await user.click(screen.getByTestId('text-popout-save'))
    await waitFor(() => expect(notesState.editNote).toHaveBeenCalledWith(1, expect.objectContaining({
      type: 'general', body: '<p>Tweede</p> extra',
    })))
  })

  it('shows the skeleton while the thread has not loaded yet — never a premature "not found"', () => {
    notesState.loaded = false
    notesState.notes = []
    renderAt('/popout/notes/candidate/c1/n2')
    expect(screen.getByText('common:loading')).toBeInTheDocument()
    expect(screen.queryByText('popout.noteNotFound')).toBeNull()
  })

  it('shows the honest not-found row once the thread loaded without the note', () => {
    notesState.notes = [{ id: 'n1', type: 'general', body: '<p>Eerste</p>' }]
    renderAt('/popout/notes/candidate/c1/ontbreekt')
    expect(screen.getByText('popout.noteNotFound')).toBeInTheDocument()
    expect(screen.queryByLabelText('body')).toBeNull()
  })

  it('renders someone else\'s note read-only — a pasted URL is not a licence (§7)', () => {
    notesState.notes = [{ id: 'n1', type: 'general', body: '<p>Van een ander</p>', author_id: 'u2' }]
    renderAt('/popout/notes/candidate/c1/n1')
    expect(screen.getByText('popout.noteReadOnly')).toBeInTheDocument()
    expect(screen.getByText('Van een ander')).toBeInTheDocument()
    expect(screen.queryByTestId('text-popout-save')).toBeNull()
  })

  it('refuses an entity whose window cannot PATCH a note (customer) — error row, never a form', () => {
    renderAt('/popout/notes/customer/x1/n1')
    expect(screen.getByText('popout.loadError')).toBeInTheDocument()
    expect(screen.queryByLabelText('body')).toBeNull()
  })
})
