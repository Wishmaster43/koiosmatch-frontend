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

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v, formatTime: (v: string) => v, locale: 'nl-NL' }) }))
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

// A-popout-1 (14-08): the generalised application branch — mirrors the candidate
// mocks above, one-to-one, so both branches of the dispatcher are exercised the
// same way.
const { appNotesState } = vi.hoisted(() => ({
  appNotesState: { notes: [] as Array<Record<string, unknown>>, editNote: vi.fn() },
}))
vi.mock('./hooks/usePopoutApplicationNotes', () => ({ usePopoutApplicationNotes: () => appNotesState }))
const { appLiteState } = vi.hoisted(() => ({
  appLiteState: { application: null as { id: string; candidateName: string; vacancyTitle: string; initials: string } | null, loading: false, error: false, reload: vi.fn() },
}))
vi.mock('./hooks/useApplicationLite', () => ({ useApplicationLite: () => appLiteState }))

// POPOUT-PARITEIT-1 (27-08): the generalised GenericNoteEditPopout branch —
// proves a non-candidate/application entity (match) reaches the dispatcher's
// registration AND saves through its own PATCH route (useEntityNotes), not
// merely that the icon shows up.
const { matchLiteState } = vi.hoisted(() => ({
  matchLiteState: { match: null as { id: string; candidateName: string; vacancyTitle: string; initials: string } | null, loading: false, error: false, reload: vi.fn() },
}))
vi.mock('./hooks/useMatchLite', () => ({ useMatchLite: () => matchLiteState }))
// Same minimal identity for the opportunity branch (react-query-free harness).
vi.mock('./hooks/useOpportunityLite', () => ({ useOpportunityLite: () => ({ opportunity: { id: 'o1', name: 'Kans', initials: 'K' }, loading: false, error: false, reload: () => {} }) }))
const { entityNotesState } = vi.hoisted(() => ({
  entityNotesState: { notes: [] as Array<Record<string, unknown>>, loading: false, error: false, fetchNotes: vi.fn(), addNote: vi.fn(), editNote: vi.fn(), deleteNote: vi.fn() },
}))
// Spy keeps the call ARGS assertable: the generic branch must hand the hook the
// EXPLICIT api base + method (the namespace-coincidence bug the audit caught).
const useEntityNotesSpy = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/useEntityNotes', () => ({ useEntityNotes: (args: unknown) => { useEntityNotesSpy(args); return entityNotesState } }))

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

  it('refuses an entity outside NOTE_EDIT_POPOUT_ENTITIES (outreachTarget) — error row, never a form', () => {
    // outreachTarget has no notes THREAD at all (a plain `note` column, see
    // secondScreen.ts's own doc) — it can never gain a per-note edit route.
    renderAt('/popout/notes/outreachTarget/x1/n1')
    expect(screen.getByText('popout.loadError')).toBeInTheDocument()
    expect(screen.queryByLabelText('body')).toBeNull()
  })
})

// A-popout-1 (14-08): the generalised application branch — same four states +
// the same seam (save through editNote at the URL-resolved index), proving the
// dispatcher's second branch is not just wired but really works end to end.
describe('NoteEditPopout · application branch (A-popout-1)', () => {
  const previousTitle = document.title
  beforeEach(() => {
    vi.spyOn(window, 'close').mockImplementation(() => {})
    appLiteState.application = { id: 'a1', candidateName: 'Sanne de Vries', vacancyTitle: 'Verzorgende IG', initials: 'SV' }
    appLiteState.loading = false
    appLiteState.error = false
    appLiteState.reload = vi.fn()
    appNotesState.notes = [
      { id: 'n1', type: 'general', text: '<p>Eerste</p>', author_id: 'u1' },
      { id: 'n2', type: 'general', text: '<p>Tweede</p>', author_id: 'u1' },
    ]
    appNotesState.editNote = vi.fn().mockResolvedValue(true)
  })
  afterEach(() => { document.title = previousTitle; vi.restoreAllMocks() })

  it("renders the application's candidate name and THAT note's text", () => {
    renderAt('/popout/notes/application/a1/n2')
    expect(screen.getByText('Sanne de Vries')).toBeInTheDocument()
    expect(screen.getByLabelText('body')).toHaveValue('<p>Tweede</p>')
  })

  it('saves through editNote at the URL-resolved index — the seam (§13)', async () => {
    const user = userEvent.setup()
    renderAt('/popout/notes/application/a1/n2')
    await user.type(screen.getByLabelText('body'), ' extra')
    await user.click(screen.getByTestId('text-popout-save'))
    await waitFor(() => expect(appNotesState.editNote).toHaveBeenCalledWith(1, expect.objectContaining({
      type: 'general', body: '<p>Tweede</p> extra',
    })))
  })

  it('shows the honest not-found row for a note id absent from the thread', () => {
    appNotesState.notes = [{ id: 'n1', type: 'general', text: '<p>Eerste</p>' }]
    renderAt('/popout/notes/application/a1/ontbreekt')
    expect(screen.getByText('common:popout.noteNotFound')).toBeInTheDocument()
    expect(screen.queryByLabelText('body')).toBeNull()
  })
})

// POPOUT-PARITEIT-1 (27-08): the generic branch — proves a non-candidate/
// application entity really registers in the dispatcher AND persists its edit
// through ITS OWN PATCH route (useEntityNotes basePath `/matches/{id}`), not
// just that the popout renders.
describe('NoteEditPopout · generic branch (match, POPOUT-PARITEIT-1)', () => {
  const previousTitle = document.title
  beforeEach(() => {
    vi.spyOn(window, 'close').mockImplementation(() => {})
    matchLiteState.match = { id: 'm1', candidateName: 'Bram Jansen', vacancyTitle: 'Verpleegkundige', initials: 'BJ' }
    matchLiteState.loading = false
    matchLiteState.error = false
    matchLiteState.reload = vi.fn()
    entityNotesState.notes = [
      { id: 'n1', type: 'general', text: '<p>Eerste</p>', author_id: 'u1' },
      { id: 'n2', type: 'general', text: '<p>Tweede</p>', author_id: 'u1' },
    ]
    entityNotesState.editNote = vi.fn().mockResolvedValue(true)
  })
  afterEach(() => { document.title = previousTitle; vi.restoreAllMocks() })

  it("renders the match's candidate name and THAT note's text", () => {
    renderAt('/popout/notes/match/m1/n2')
    expect(screen.getByText('Bram Jansen')).toBeInTheDocument()
    expect(screen.getByLabelText('body')).toHaveValue('<p>Tweede</p>')
  })

  it('saves through the SAME PATCH route the match drawer uses (useEntityNotes.editNote) — the seam (§13)', async () => {
    const user = userEvent.setup()
    renderAt('/popout/notes/match/m1/n2')
    await user.type(screen.getByLabelText('body'), ' extra')
    await user.click(screen.getByTestId('text-popout-save'))
    await waitFor(() => expect(entityNotesState.editNote).toHaveBeenCalledWith(1, expect.objectContaining({
      type: 'general', body: '<p>Tweede</p> extra',
    })))
    // The route/method is EXPLICIT, never derived from the i18n namespace — this
    // is the exact coupling that let the opportunity PUT/PATCH mismatch slip.
    expect(useEntityNotesSpy).toHaveBeenCalledWith(expect.objectContaining({ basePath: '/matches/m1', updateMethod: 'patch' }))
  })

  // Opportunities' note-update route registers PUT only (measured 27-08) — the
  // generic branch must hand the hook updateMethod 'put' there, or every save 405s.
  it('hands the opportunity branch the PUT method its route requires', () => {
    useEntityNotesSpy.mockClear()
    renderAt('/popout/notes/opportunity/o1/n2')
    expect(useEntityNotesSpy).toHaveBeenCalledWith(expect.objectContaining({ basePath: '/opportunities/o1', updateMethod: 'put' }))
  })
})
