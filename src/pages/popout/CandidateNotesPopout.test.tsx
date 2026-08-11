/**
 * CandidateNotesPopout — the four UI states (§3): loading skeleton, error+retry,
 * success (header + shared NotesTab), and the document.title bootstrap/restore.
 * Mirrors CommunicationTab.test.tsx's mocking convention for the note-type/
 * last-contact lookups so this stays a focused test of THIS page's own wiring.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CandidateNotesPopout from './CandidateNotesPopout'
import { noteDraftTopic } from '@/lib/secondScreen'

// NotesTab pulls in `@/lib/datetime`, which side-effect-imports the real i18n
// bootstrap (`src/i18n`) for LOCALE_BY_LANG — mocked here so this test, like
// CommunicationTab.test.tsx, stays on react-i18next's key-fallback behaviour
// (no real translation resources loaded) instead of rendering real Dutch copy.
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v, locale: 'nl-NL' }) }))
vi.mock('@/lib/useNoteTypes', () => ({ useNoteTypes: () => ({ types: [], writableTypes: [] }), SYSTEM_NOTE_TYPES: new Set(['status_change']) }))
vi.mock('@/lib/useLastContactTypes', () => ({ useLastContactTypes: () => ({ types: [] }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => false }) }))
// Tiptap is out of scope for this page test (mirrors NotesTab/NoteComposer's own
// convention); the stub gives the composer a plain, readable body control.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea aria-label="body" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))
// Mutable per-test note thread + spies (vi.hoisted so the mock factory can read it).
const { notesState } = vi.hoisted(() => ({
  notesState: {
    notes: [] as Array<Record<string, unknown>>,
    addNote: vi.fn(), editNote: vi.fn(), deleteNote: vi.fn(),
  },
}))
vi.mock('@/pages/candidates/hooks/useCandidateNotes', () => ({
  useCandidateNotes: () => notesState,
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
    notesState.notes = []
    notesState.addNote = vi.fn()
    notesState.editNote = vi.fn()
    notesState.deleteNote = vi.fn()
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

  // NOTITIE-POPOUT-BAR-1 (Danny 09-08, point 3): the toolbar pop-out button belongs
  // in the DRILL-DOWN, never in the second-screen window itself — a button that
  // re-opens the window you are already looking at is nonsense. Since
  // NOTITIE-POPOUT-HANDOFF-1 this page DOES name its popout target, but with
  // `role: 'window'` — the receiving side, which renders no button of its own.
  it('never shows the pop-out button inside the pop-out window itself', () => {
    liteState.candidate = { id: 'cand-1', name: 'Anne de Vries', initials: 'AD' }
    render(<CandidateNotesPopout id="cand-1" />)
    expect(screen.getByText('sections.notesEmpty')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'openSecondScreen' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'common:openSecondScreen' })).toBeNull()
  })

  /**
   * NOTITIE-POPOUT-EDIT-1 (Danny 10-08): the drill-down's per-note icon asks THIS
   * window to open one EXISTING note. The risk that matters is a duplicate — or, as
   * dangerous, a patch landing on the WRONG note: this page filters system notes out
   * of the thread, so the composer's index is a FILTERED index that must be remapped
   * back to the note's real position before it is saved. Asserted end-to-end here,
   * over the real handoff channel, because a unit test on either half alone would
   * have missed exactly that remapping.
   */
  describe('a handed-over note edit', () => {
    // In-memory BroadcastChannel (jsdom ships none) — same double as the hook test.
    const buses = new Map<string, Set<FakeChannel>>()
    class FakeChannel {
      onmessage: ((e: { data: unknown }) => void) | null = null
      constructor(public topic: string) {
        if (!buses.has(topic)) buses.set(topic, new Set())
        buses.get(topic)!.add(this)
      }
      postMessage(data: unknown) {
        buses.get(this.topic)?.forEach(peer => { if (peer !== this) peer.onmessage?.({ data }) })
      }
      close() { buses.get(this.topic)?.delete(this) }
    }
    let seen: unknown[]
    let peer: FakeChannel

    beforeEach(() => {
      buses.clear()
      seen = []
      vi.stubGlobal('BroadcastChannel', FakeChannel as unknown as typeof BroadcastChannel)
      peer = new FakeChannel(noteDraftTopic('candidate', 'cand-1'))
      peer.onmessage = e => seen.push(e.data)
      liteState.candidate = { id: 'cand-1', name: 'Anne de Vries', initials: 'AD' }
      // A system note sits FIRST, so the filtered index and the real index differ.
      notesState.notes = [
        { id: 'sys-1', type: 'status_change', body: 'Status gewijzigd' },
        { id: 'n1', type: 'note', body: '<p>Eerste</p>' },
        { id: 'n2', type: 'note', body: '<p>Tweede</p>' },
      ]
    })
    afterEach(() => vi.unstubAllGlobals())

    it('opens THAT note in this window, acks it, and saves it onto the SAME record', async () => {
      const user = userEvent.setup()
      render(<CandidateNotesPopout id="cand-1" />)
      act(() => peer.postMessage({ kind: 'edit', noteId: 'n2' }))

      // Found and shown — only then is the drill-down told.
      expect(screen.getByLabelText('body')).toHaveValue('<p>Tweede</p>')
      expect(seen).toContainEqual({ kind: 'ack' })

      await user.click(screen.getByTitle('common:save'))
      // Real index 2 (filtered index 1 + the system note this page hides), never a new note.
      expect(notesState.editNote).toHaveBeenCalledWith(2, expect.objectContaining({ body: expect.stringContaining('Tweede') }))
      expect(notesState.addNote).not.toHaveBeenCalled()
    })

    it('never acks a note id this window does not have — no composer, no confirmation', () => {
      render(<CandidateNotesPopout id="cand-1" />)
      act(() => peer.postMessage({ kind: 'edit', noteId: 'not-here' }))
      expect(screen.queryByLabelText('body')).toBeNull()
      expect(seen).not.toContainEqual({ kind: 'ack' })
    })
  })

  it('sets the window title to the candidate popout title and restores it on unmount', () => {
    liteState.candidate = { id: 'cand-1', name: 'Anne de Vries', initials: 'AD' }
    const { unmount } = render(<CandidateNotesPopout id="cand-1" />)
    expect(document.title).toBe('popout.windowTitle')
    unmount()
    expect(document.title).toBe(previousTitle)
  })
})
