/** NotesTab · composer pop-out handoff, durable concept (K-161) and restore previous version (NOTE-UNDO-FE-1). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotesTab from './NotesTab'
import { noteDraftTopic } from '@/lib/secondScreen'

// The second-screen window opener — jsdom's window.open does nothing useful, and
// the handoff needs to distinguish "window opened" from "popup blocked".
const { openNotesPopoutMock, openNoteEditPopoutMock } = vi.hoisted(() => ({ openNotesPopoutMock: vi.fn(), openNoteEditPopoutMock: vi.fn() }))
vi.mock('@/lib/secondScreen', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/secondScreen')>()),
  openNotesPopout: openNotesPopoutMock,
  openNoteEditPopout: openNoteEditPopoutMock,
}))

// Tiptap is out of scope here (mirrors NoteComposer.test.tsx's own convention);
// the stub gives the note body a plain, typable control so a HANDOFF test can
// prove the recruiter's actual keystrokes travel.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange, toolbarExtra }: { value?: string; onChange: (v: string) => void; toolbarExtra?: React.ReactNode }) => (
    <div data-testid="rte-wrapper">
      {toolbarExtra}
      <textarea aria-label="body" value={value ?? ''} onChange={e => onChange(e.target.value)} />
    </div>
  ),
}))

// In-memory stand-in for BroadcastChannel — one bus per topic, and (like the real
// thing) a channel never receives its own message. Same double as
// pages/popout/hooks/useTextPopoutDraft.test.ts, which jsdom also forces.
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

// formatDateTime added alongside the existing formatDate mock (distinguishable
// transform, not identity) — proves the Tijdlijn section routes `time` through
// the house formatter instead of rendering the raw ISO field (Danny 05-08).
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({
    formatDate: (v: string) => `d(${v})`,
    formatDateTime: (v?: string | null) => (v ? `dt(${v})` : '—'),
    // NOTES-TIMELINE-CONVERGE-1: the shared EventTimeline shows formatTime on the
    // row itself and formatDateTime only in the hover title.
    formatTime: (v?: string | null) => (v ? `t(${v})` : ''),
  }),
}))
// Auth mock (RECHTEN-DETAIL-1 rights gate below) — module-level, mirrors the
// GeocodeButton/SmSyncButton convention so vi.mock's hoist never races the
// `const` it closes over. Defaults to "no user" so every OTHER describe block
// in this file (search/error/timeline) renders exactly as before — none of
// their notes carry author_id, so canManageNote short-circuits to permissive
// regardless of what this mock returns.
const mockUseAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
// CONCEPT-NOTE-2: the durable-draft seam, mocked per test.
vi.mock('./notes/noteDraftApi', () => ({
  getNoteDraft: vi.fn().mockResolvedValue(null),
  putNoteDraft: vi.fn().mockResolvedValue(true),
  deleteNoteDraft: vi.fn().mockResolvedValue(undefined),
}))
beforeEach(() => { mockUseAuth.mockReturnValue(null) })

const labels = {
  notes: 'Notities', newNote: 'Nieuwe notitie', notesEmpty: 'Geen notities',
  searchPlaceholder: 'Zoek notities…', save: 'Save', cancel: 'Cancel', edit: 'Bewerken',
}

const note = (over: Record<string, unknown> = {}) => ({
  type: 'note', title: '', author: 'Eva', text: '<p>Hello world</p>', created_at: '2026-08-01', ...over,
})

describe('NotesTab · pop-out from the composer hands the text over', () => {
  const target = { entity: 'candidate' as const, id: 'c1' }
  const topic = noteDraftTopic(target.entity, target.id)
  const popoutLabels = { ...labels, notePlaceholder: () => 'Titel…' }
  // Every message the second screen would see.
  let seen: unknown[]
  let peer: FakeChannel

  beforeEach(() => {
    buses.clear()
    seen = []
    openNotesPopoutMock.mockReturnValue({} as Window)
    vi.stubGlobal('BroadcastChannel', FakeChannel as unknown as typeof BroadcastChannel)
    peer = new FakeChannel(topic)
    peer.onmessage = e => seen.push(e.data)
  })
  afterEach(() => vi.unstubAllGlobals())

  // Opens the composer and writes a half-typed note into it.
  const composeHalfANote = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: labels.newNote }))
    await user.type(screen.getByLabelText('body'), 'Halve notitie')
    await user.type(screen.getByPlaceholderText('Titel…'), 'Belnotitie')
  }
  // The composer's OWN pop-out icon — scoped to the note-title row inside the
  // FloatingPanel, so a note row's own icon (NOTITIE-POPOUT-EDIT-1) is never picked up.
  const blockPopOut = () => {
    const titleRow = screen.getByPlaceholderText('Titel…').parentElement!
    return titleRow.querySelector('button[aria-label="openSecondScreen"]') as HTMLButtonElement | null
  }
  const drafts = () => seen.filter((m): m is { kind: 'draft'; note: Record<string, unknown> } =>
    typeof m === 'object' && m !== null && (m as { kind?: string }).kind === 'draft')

  it('puts the icon in the note BLOCK — never in the window title bar any more', async () => {
    const user = userEvent.setup()
    render(<NotesTab notes={[note()]} labels={popoutLabels} popout={target}
      showTimeline={false} showConversations={false} />)
    await user.click(screen.getByRole('button', { name: labels.newNote }))

    // The FloatingPanel's drag handle IS its title bar — the icon left it.
    const dragHandle = screen.getByRole('dialog').querySelector('[data-drag-handle]')!
    expect(dragHandle.querySelector('button[aria-label="openSecondScreen"]')).toBeNull()
    // It sits in the block's own title row instead, next to the note title.
    expect(blockPopOut()).not.toBeNull()
  })

  it('publishes the TYPED note on the handoff topic — the text travels', async () => {
    const user = userEvent.setup()
    render(<NotesTab notes={[note()]} labels={popoutLabels} popout={target}
      showTimeline={false} showConversations={false} />)
    await composeHalfANote(user)
    await user.click(blockPopOut()!)

    expect(openNotesPopoutMock).toHaveBeenCalledWith('candidate', 'c1')
    expect(drafts()).toHaveLength(1)
    expect(drafts()[0].note).toEqual(expect.objectContaining({ body: 'Halve notitie', title: 'Belnotitie' }))
  })

  it('keeps the composer — WITH the text — open until the second screen acks', async () => {
    const user = userEvent.setup()
    render(<NotesTab notes={[note()]} labels={popoutLabels} popout={target}
      showTimeline={false} showConversations={false} />)
    await composeHalfANote(user)
    await user.click(blockPopOut()!)

    // Nothing acked yet: the text is still here, not gone with a closed window.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('body')).toHaveValue('Halve notitie')

    act(() => peer.postMessage({ kind: 'ack' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('never publishes NOR closes when the browser blocked the pop-out window', async () => {
    const user = userEvent.setup()
    openNotesPopoutMock.mockReturnValue(null)
    render(<NotesTab notes={[note()]} labels={popoutLabels} popout={target}
      showTimeline={false} showConversations={false} />)
    await composeHalfANote(user)
    await user.click(blockPopOut()!)

    expect(drafts()).toHaveLength(0)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('body')).toHaveValue('Halve notitie')
  })

  it('replays the draft to a window that boots LATER and says hello', async () => {
    const user = userEvent.setup()
    render(<NotesTab notes={[note()]} labels={popoutLabels} popout={target}
      showTimeline={false} showConversations={false} />)
    await composeHalfANote(user)
    await user.click(blockPopOut()!)
    seen.length = 0

    act(() => peer.postMessage({ kind: 'hello' }))
    expect(drafts()[0].note).toEqual(expect.objectContaining({ body: 'Halve notitie' }))
  })

  it('shows no hand-over icon while EDITING an existing note (it would save as a new one)', async () => {
    const user = userEvent.setup()
    render(<NotesTab notes={[note({ text: '<p>Bestaand</p>' })]} labels={popoutLabels} popout={target}
      onEditNote={vi.fn()} showTimeline={false} showConversations={false} />)
    await user.click(screen.getByTitle('Bewerken'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(blockPopOut()).toBeNull()
  })

  // The RECEIVING half: this render IS the second screen.
  it('opens its own composer on an incoming draft and acks it', () => {
    render(<NotesTab notes={[]} labels={popoutLabels} popout={{ ...target, role: 'window' }}
      showTimeline={false} showConversations={false} />)
    act(() => peer.postMessage({ kind: 'draft', note: { type: '', channel: '', title: 'Belnotitie', body: 'Halve notitie' } }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('body')).toHaveValue('Halve notitie')
    expect(screen.getByPlaceholderText('Titel…')).toHaveValue('Belnotitie')
    // Acked only from the render that shows it — that ack is what lets the
    // drill-down close its own composer.
    expect(seen).toContainEqual({ kind: 'ack' })
  })

  it('does NOT ack (and so never costs text) when its own composer is already busy', async () => {
    const user = userEvent.setup()
    render(<NotesTab notes={[]} labels={popoutLabels} popout={{ ...target, role: 'window' }}
      showTimeline={false} showConversations={false} />)
    await user.click(screen.getByRole('button', { name: labels.newNote }))
    await user.type(screen.getByLabelText('body'), 'Eigen tekst')
    seen.length = 0

    act(() => peer.postMessage({ kind: 'draft', note: { type: '', channel: '', title: 'Belnotitie', body: 'Halve notitie' } }))
    expect(seen).not.toContainEqual({ kind: 'ack' })
    // This window's own text is untouched — one text loss is never traded for another.
    expect(screen.getByLabelText('body')).toHaveValue('Eigen tekst')
  })
})

// CONCEPT-NOTE-2 (K-161): the durable layer — load on mount, PUT on a
// content-carrying cancel, DELETE on save; hosts without draftEntity never
// touch the endpoint.
describe('NotesTab · durable concept (K-161)', () => {
  it('loads the stored draft for the named dossier on mount', async () => {
    const { getNoteDraft } = await import('./notes/noteDraftApi')
    render(<NotesTab notes={[]} labels={labels} showTimeline={false} showConversations={false}
      draftEntity={{ type: 'candidate', id: 'c-1' }} />)
    await waitFor(() => expect(getNoteDraft).toHaveBeenCalledWith('candidate', 'c-1', expect.anything()))
  })

  it('never calls the endpoint without a draftEntity', async () => {
    const { getNoteDraft } = await import('./notes/noteDraftApi')
    vi.mocked(getNoteDraft).mockClear()
    render(<NotesTab notes={[]} labels={labels} showTimeline={false} showConversations={false} />)
    await new Promise(r => setTimeout(r, 0))
    expect(getNoteDraft).not.toHaveBeenCalled()
  })

  it('PUTs the concept on a content-carrying cancel and DELETEs it on save', async () => {
    const { putNoteDraft, deleteNoteDraft } = await import('./notes/noteDraftApi')
    const user = userEvent.setup()
    render(<NotesTab notes={[]} onAddNote={vi.fn()} labels={labels} showTimeline={false} showConversations={false}
      draftEntity={{ type: 'customer', id: 'k-9' }} />)

    // Open the composer, type a title, cancel — the draft must persist.
    await user.click(screen.getByRole('button', { name: 'Nieuwe notitie' }))
    // The harness stubs RichTextEditor as an aria-label="body" textarea — type
    // the BODY (the search box's placeholder also matches /notitie/, a trap).
    await user.type(screen.getByLabelText('body'), 'Bel Bas terug')
    await user.click(screen.getByTitle('Cancel'))
    await waitFor(() => expect(putNoteDraft).toHaveBeenCalledWith('customer', 'k-9', expect.objectContaining({ body: expect.stringContaining('Bel Bas terug') })))

    // Reopen (concept restores) and save — the stored draft must clear.
    await user.click(screen.getByRole('button', { name: 'Nieuwe notitie' }))
    await user.click(screen.getByTitle('Save'))
    await waitFor(() => expect(deleteNoteDraft).toHaveBeenCalledWith('customer', 'k-9'))
  })
})

/**
 * NOTE-UNDO-FE-1 (K-172): the shared "restore previous version" action — this
 * suite is entity-agnostic (NotesTab itself), the family-specific REQUEST shape
 * (method/route) is pinned separately on the candidates + customers hooks.
 */

describe('NotesTab · restore previous version (NOTE-UNDO-FE-1)', () => {
  const undoLabels = { ...labels, restorePrevious: 'Vorige versie terug', restoreConfirmTitle: 'Vorige versie terugzetten' }

  it('renders no action at all when has_previous_version is false, even with both callbacks wired', () => {
    render(<NotesTab notes={[note({ has_previous_version: false })]} labels={undoLabels}
      onFetchPreviousVersion={vi.fn()} onRestorePreviousNote={vi.fn()} showTimeline={false} showConversations={false} />)
    expect(screen.queryByTitle('Vorige versie terug')).toBeNull()
  })

  it('renders no action when the host has not wired the restore callbacks (no fake affordance)', () => {
    render(<NotesTab notes={[note({ has_previous_version: true })]} labels={undoLabels}
      showTimeline={false} showConversations={false} />)
    expect(screen.queryByTitle('Vorige versie terug')).toBeNull()
  })

  it('peeks the previous version, shows a confirm dialog with the previous text via SafeHtml, and restores on confirm', async () => {
    const user = userEvent.setup()
    const onFetchPreviousVersion = vi.fn().mockResolvedValue({ previous_body: '<p>Oude tekst</p>', previous_saved_at: '2026-08-20T10:00:00Z' })
    const onRestorePreviousNote = vi.fn().mockResolvedValue(true)
    render(<NotesTab notes={[note({ has_previous_version: true })]} labels={undoLabels}
      onFetchPreviousVersion={onFetchPreviousVersion} onRestorePreviousNote={onRestorePreviousNote}
      showTimeline={false} showConversations={false} />)

    await user.click(screen.getByTitle('Vorige versie terug'))
    expect(onFetchPreviousVersion).toHaveBeenCalledWith(0)
    // The preview renders the PREVIOUS body (raw HTML stripped by SafeHtml's own
    // sanitizer, never dangerouslySetInnerHTML'd straight from the response).
    await waitFor(() => expect(screen.getByText('Oude tekst')).toBeInTheDocument())
    expect(screen.getByText('Vorige versie terugzetten')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'confirm' }))
    expect(onRestorePreviousNote).toHaveBeenCalledWith(0)
  })

  it('degrades calmly (an info toast, no red error) when the peek finds no slot (422)', async () => {
    const user = userEvent.setup()
    const onFetchPreviousVersion = vi.fn().mockResolvedValue(null)
    const onRestorePreviousNote = vi.fn()
    const toasts: Array<{ type: string; message: string }> = []
    const onToast = (e: Event) => toasts.push((e as CustomEvent).detail)
    window.addEventListener('km:toast', onToast)
    render(<NotesTab notes={[note({ has_previous_version: true })]} labels={undoLabels}
      onFetchPreviousVersion={onFetchPreviousVersion} onRestorePreviousNote={onRestorePreviousNote}
      showTimeline={false} showConversations={false} />)

    await user.click(screen.getByTitle('Vorige versie terug'))
    await waitFor(() => expect(toasts.length).toBeGreaterThan(0))
    expect(toasts[0].type).toBe('info')
    expect(onRestorePreviousNote).not.toHaveBeenCalled()
    window.removeEventListener('km:toast', onToast)
  })

  // A FAILED restore keeps the current text on screen (revert contract): the
  // row must not show the previous body when onRestorePreviousNote resolves false.
  it('keeps the current note text when the restore itself fails', async () => {
    const user = userEvent.setup()
    const onFetchPreviousVersion = vi.fn().mockResolvedValue({ previous_body: '<p>Oude tekst</p>', previous_saved_at: '2026-08-20T10:00:00Z' })
    const onRestorePreviousNote = vi.fn().mockResolvedValue(false)
    render(<NotesTab notes={[note({ has_previous_version: true, text: '<p>Huidige tekst</p>' })]} labels={undoLabels}
      onFetchPreviousVersion={onFetchPreviousVersion} onRestorePreviousNote={onRestorePreviousNote}
      showTimeline={false} showConversations={false} />)

    await user.click(screen.getByTitle('Vorige versie terug'))
    await waitFor(() => expect(screen.getByText('Vorige versie terugzetten')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'confirm' }))
    expect(onRestorePreviousNote).toHaveBeenCalledWith(0)
    // The visible row still carries the CURRENT text — never the previous one.
    expect(screen.getByText('Huidige tekst')).toBeInTheDocument()
    expect(screen.queryByText('Oude tekst')).not.toBeInTheDocument()
  })
})
