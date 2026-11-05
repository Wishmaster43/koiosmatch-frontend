/** NotesTab · filter menu (NOTE-FILTERS-1) and per-note pop-out (NOTITIE-POPOUT-EDIT-1). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
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

describe('NotesTab · type/channel filter menu (NOTE-FILTERS-1)', () => {
  const filterLabels = { ...labels, type: 'Type', channel: 'Kanaal' }
  const noteTypes = [{ value: 'call', label: 'Bellen' }, { value: 'email', label: 'E-mail' }]
  const channels = [{ value: 'phone', label: 'Telefoon' }, { value: 'whatsapp', label: 'WhatsApp' }]

  it('the toolbar no longer renders the type/channel dropdowns inline — only ONE Filter button', () => {
    render(<NotesTab notes={[note()]} labels={filterLabels} noteTypes={noteTypes} channels={channels}
      showTimeline={false} showConversations={false} />)
    // The old inline placeholders are gone from the toolbar row entirely.
    expect(screen.queryByText('notes.allTypes')).toBeNull()
    expect(screen.queryByText('notes.allChannels')).toBeNull()
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument()
  })

  it('picking a TYPE in the menu narrows the visible notes exactly as the old inline dropdown did', async () => {
    const user = userEvent.setup()
    render(<NotesTab
      notes={[note({ type: 'call', text: '<p>Belnotitie</p>' }), note({ type: 'email', text: '<p>Mailnotitie</p>' })]}
      labels={filterLabels} noteTypes={noteTypes} channels={channels} showTimeline={false} showConversations={false} />)
    expect(screen.getByText('Belnotitie')).toBeInTheDocument()
    expect(screen.getByText('Mailnotitie')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('button', { name: 'notes.allTypes' }))
    await user.click(screen.getByRole('button', { name: 'Bellen' }))

    expect(screen.getByText('Belnotitie')).toBeInTheDocument()
    expect(screen.queryByText('Mailnotitie')).toBeNull()
  })

  it('picking a CHANNEL in the menu narrows the visible notes exactly as the old inline dropdown did', async () => {
    const user = userEvent.setup()
    render(<NotesTab
      notes={[note({ channel: 'phone', text: '<p>Telefoonnotitie</p>' }), note({ channel: 'whatsapp', text: '<p>WA-notitie</p>' })]}
      labels={filterLabels} noteTypes={noteTypes} channels={channels} showTimeline={false} showConversations={false} />)

    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('button', { name: 'notes.allChannels' }))
    await user.click(screen.getByRole('button', { name: 'WhatsApp' }))

    expect(screen.getByText('WA-notitie')).toBeInTheDocument()
    expect(screen.queryByText('Telefoonnotitie')).toBeNull()
  })

  it('the badge reflects the number of ACTIVE filters, and clear-all resets both to "all"', async () => {
    const user = userEvent.setup()
    render(<NotesTab
      notes={[note({ type: 'call', channel: 'phone', text: '<p>Match</p>' }), note({ type: 'email', channel: 'whatsapp', text: '<p>NoMatch</p>' })]}
      labels={filterLabels} noteTypes={noteTypes} channels={channels} showTimeline={false} showConversations={false} />)

    // Picking a value keeps the panel OPEN (so a second filter can be set in the
    // same visit) — no need to re-click "Filter" between the two picks below.
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('button', { name: 'notes.allTypes' }))
    await user.click(screen.getByRole('button', { name: 'Bellen' }))
    await user.click(screen.getByRole('button', { name: 'notes.allChannels' }))
    await user.click(screen.getByRole('button', { name: 'Telefoon' }))
    expect(screen.getByText('Match')).toBeInTheDocument()
    expect(screen.queryByText('NoMatch')).toBeNull()
    // Both filters active — the badge shows 2.
    expect(screen.getByText('2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'filters.clearAll' }))
    // Clearing both restores the full list.
    expect(screen.getByText('Match')).toBeInTheDocument()
    expect(screen.getByText('NoMatch')).toBeInTheDocument()
    expect(screen.queryByText('2')).toBeNull()
  })

  it('Escape closes the filter panel', async () => {
    const user = userEvent.setup()
    render(<NotesTab notes={[note()]} labels={filterLabels} noteTypes={noteTypes} channels={channels}
      showTimeline={false} showConversations={false} />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders no Filter button at all when the host offers neither vocabulary (no fake affordance)', () => {
    render(<NotesTab notes={[note()]} labels={filterLabels} showTimeline={false} showConversations={false} />)
    expect(screen.queryByRole('button', { name: 'Filter' })).toBeNull()
  })
})

/**
 * NOTITIE-POPOUT-EDIT-1 (Danny 10-08: "1. Icon staat nog steeds naast filter en
 * opent geen pop-out editor modus. 2. Icon moet onder change en prullenbakje komen
 * … en direct edit pop-out"). The toolbar button is REMOVED and the affordance now
 * sits per note, third after the pencil and the bin, opening THAT note in the
 * second screen's editor.
 *
 * The dangerous outcome is a DUPLICATE note (two notes, no way to tell which is
 * real), so the gates below are the point of this block: only where the receiving
 * window can really PATCH a note, only with the same rights as the pencil, only for
 * a note with a real id — and the window confirms only once it FOUND that note.
 * No real i18next instance runs in this file, so `t('openSecondScreen')` falls back
 * to the raw key.
 */

describe('NotesTab · per-note pop-out (NOTITIE-POPOUT-EDIT-1)', () => {
  const target = { entity: 'candidate' as const, id: 'c1' }
  const topic = noteDraftTopic(target.entity, target.id)
  const editLabels = { ...labels, deleteNote: 'Verwijderen', notePlaceholder: () => 'Titel…' }
  const first = note({ id: 'n1', text: '<p>Eerste</p>' })
  const second = note({ id: 'n2', text: '<p>Tweede</p>' })
  let seen: unknown[]
  let peer: FakeChannel

  beforeEach(() => {
    buses.clear()
    seen = []
    openNotesPopoutMock.mockReset().mockReturnValue({} as Window)
    vi.stubGlobal('BroadcastChannel', FakeChannel as unknown as typeof BroadcastChannel)
    peer = new FakeChannel(topic)
    peer.onmessage = e => seen.push(e.data)
  })
  afterEach(() => vi.unstubAllGlobals())

  // The icon buttons of the note header row the pencil lives in, in DOM order.
  const rowIcons = () =>
    [...screen.getByTitle('Bewerken').parentElement!.querySelectorAll('button')]
      .map(b => b.getAttribute('aria-label'))

  it('sits in the note header as the THIRD icon, after the pencil and the bin', () => {
    render(<NotesTab notes={[first]} labels={editLabels} popout={target}
      onEditNote={vi.fn()} onDeleteNote={vi.fn()} showTimeline={false} showConversations={false} />)
    expect(rowIcons()).toEqual(['Bewerken', 'Verwijderen', 'openSecondScreen'])
  })

  it('is GONE from the toolbar next to Filter — the button Danny reported', () => {
    render(<NotesTab notes={[first]} labels={editLabels} popout={target} noteTypes={[{ value: 'note', label: 'Notitie' }]}
      onEditNote={vi.fn()} onDeleteNote={vi.fn()} showTimeline={false} showConversations={false} />)
    // The toolbar row is the search input's own row — it must hold no pop-out button.
    const toolbar = screen.getByPlaceholderText('Zoek notities…').closest('div')!.parentElement!
    expect(toolbar.querySelector('button[aria-label="openSecondScreen"]')).toBeNull()
    // The only one in the whole tab is the note's own.
    expect(screen.getAllByRole('button', { name: 'openSecondScreen' })).toHaveLength(1)
  })

  it('clicking it opens THAT note\'s OWN window by URL — id in the address, no channel handoff (NOTITIE-POPOUT-URL-1)', async () => {
    openNoteEditPopoutMock.mockReturnValue({} as Window)
    const user = userEvent.setup()
    render(<NotesTab notes={[first, second]} labels={editLabels} popout={target}
      onEditNote={vi.fn()} showTimeline={false} showConversations={false} />)
    // The second note's own icon (both notes carry one).
    await user.click(screen.getAllByRole('button', { name: 'openSecondScreen' })[1])

    expect(openNoteEditPopoutMock).toHaveBeenCalledWith('candidate', 'c1', 'n2')
    // No message travels: the URL carries the whole identity now.
    expect(seen).toEqual([])
    // The drill-down composer must NOT open here — the editing happens over there.
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders the icon for customer/vacancy hosts too — PATCH routes exist since 27-08, so the popout can edit', () => {
    const { unmount } = render(<NotesTab notes={[first]} labels={editLabels} popout={{ entity: 'customer', id: 'x1' }}
      onEditNote={vi.fn()} showTimeline={false} showConversations={false} />)
    expect(screen.getByRole('button', { name: 'openSecondScreen' })).toBeInTheDocument()
    unmount()

    render(<NotesTab notes={[first]} labels={editLabels} popout={{ entity: 'vacancy', id: 'v1' }}
      onEditNote={vi.fn()} showTimeline={false} showConversations={false} />)
    expect(screen.getByRole('button', { name: 'openSecondScreen' })).toBeInTheDocument()
  })

  // Still absent when the host wires no edit path or the entity is outside the set.
  it('renders none without onEditNote, and none for an entity outside the popout set', () => {
    const { unmount } = render(<NotesTab notes={[first]} labels={editLabels} popout={{ entity: 'customer', id: 'x1' }}
      showTimeline={false} showConversations={false} />)
    expect(screen.queryByRole('button', { name: 'openSecondScreen' })).toBeNull()
    unmount()

    render(<NotesTab notes={[first]} labels={editLabels} popout={{ entity: 'outreachTarget', id: 'o1' }}
      onEditNote={vi.fn()} showTimeline={false} showConversations={false} />)
    expect(screen.queryByRole('button', { name: 'openSecondScreen' })).toBeNull()
  })

  it('renders none when the host wires no edit at all (the pencil is absent too)', () => {
    render(<NotesTab notes={[first]} labels={editLabels} popout={target}
      showTimeline={false} showConversations={false} />)
    expect(screen.queryByRole('button', { name: 'openSecondScreen' })).toBeNull()
  })

  it('renders none on SOMEONE ELSE\'s note — same rights gate as the pencil', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' }, hasPermission: () => false })
    render(<NotesTab notes={[note({ id: 'n1', text: '<p>Eerste</p>', author_id: 'u2' })]} labels={editLabels}
      popout={target} onEditNote={vi.fn()} showTimeline={false} showConversations={false} />)
    expect(screen.queryByRole('button', { name: 'openSecondScreen' })).toBeNull()
  })

  it('renders none on a note without a stable id (an optimistic one no window can resolve)', () => {
    render(<NotesTab notes={[note({ text: '<p>Eerste</p>' })]} labels={editLabels} popout={target}
      onEditNote={vi.fn()} showTimeline={false} showConversations={false} />)
    expect(screen.queryByRole('button', { name: 'openSecondScreen' })).toBeNull()
  })

  it('renders none inside the popped-out window itself (no self-reopening)', () => {
    render(<NotesTab notes={[first]} labels={editLabels} popout={{ ...target, role: 'window' }}
      onEditNote={vi.fn()} showTimeline={false} showConversations={false} />)
    expect(screen.queryByRole('button', { name: 'openSecondScreen' })).toBeNull()
  })

  // The RECEIVING half — this render IS the second screen.
  it('a window asked for a note opens ITS composer on THAT note and acks', () => {
    render(<NotesTab notes={[first, second]} labels={editLabels} popout={{ ...target, role: 'window' }}
      onEditNote={vi.fn()} showTimeline={false} showConversations={false} />)
    act(() => peer.postMessage({ kind: 'edit', noteId: 'n2' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('body')).toHaveValue('<p>Tweede</p>')
    expect(seen).toContainEqual({ kind: 'ack' })
  })

  it('saving in that window PATCHES the existing note — it never adds a second one', async () => {
    const user = userEvent.setup()
    const onEditNote = vi.fn()
    const onAddNote = vi.fn()
    render(<NotesTab notes={[first, second]} labels={editLabels} popout={{ ...target, role: 'window' }}
      onAddNote={onAddNote} onEditNote={onEditNote} showTimeline={false} showConversations={false} />)
    act(() => peer.postMessage({ kind: 'edit', noteId: 'n2' }))
    await user.type(screen.getByLabelText('body'), ' aangevuld')
    await user.click(screen.getByTitle('Save'))

    // Index 1 = the note with id n2 in the list this window itself holds.
    expect(onEditNote).toHaveBeenCalledWith(1, expect.objectContaining({ body: expect.stringContaining('Tweede') }))
    expect(onAddNote).not.toHaveBeenCalled()
  })

  it('a window that does not (yet) have the note does NOT ack — and acks once the thread arrives', () => {
    const { rerender } = render(<NotesTab notes={[]} labels={editLabels} popout={{ ...target, role: 'window' }}
      onEditNote={vi.fn()} showTimeline={false} showConversations={false} />)
    act(() => peer.postMessage({ kind: 'edit', noteId: 'n2' }))

    // Thread still loading: nothing opened, nothing confirmed.
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(seen).not.toContainEqual({ kind: 'ack' })

    rerender(<NotesTab notes={[first, second]} labels={editLabels} popout={{ ...target, role: 'window' }}
      onEditNote={vi.fn()} showTimeline={false} showConversations={false} />)
    expect(screen.getByLabelText('body')).toHaveValue('<p>Tweede</p>')
    expect(seen).toContainEqual({ kind: 'ack' })
  })

  it('a window holding an UNKNOWN note id never acks (nothing is silently created)', () => {
    render(<NotesTab notes={[first]} labels={editLabels} popout={{ ...target, role: 'window' }}
      onEditNote={vi.fn()} showTimeline={false} showConversations={false} />)
    act(() => peer.postMessage({ kind: 'edit', noteId: 'gone-99' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(seen).not.toContainEqual({ kind: 'ack' })
  })

  it('a window whose own composer is busy refuses the note and keeps its own text', async () => {
    const user = userEvent.setup()
    render(<NotesTab notes={[first, second]} labels={editLabels} popout={{ ...target, role: 'window' }}
      onEditNote={vi.fn()} showTimeline={false} showConversations={false} />)
    await user.click(screen.getByRole('button', { name: labels.newNote }))
    await user.type(screen.getByLabelText('body'), 'Eigen tekst')
    seen.length = 0

    act(() => peer.postMessage({ kind: 'edit', noteId: 'n2' }))
    expect(seen).not.toContainEqual({ kind: 'ack' })
    expect(screen.getByLabelText('body')).toHaveValue('Eigen tekst')
  })
})
