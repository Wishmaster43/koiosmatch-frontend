/**
 * NotesTab · search (Danny 03-08: "bij notities wil ik ook een zoekbalk hebben").
 * Added in the SHARED component so every host (candidates/customers/opportunities/
 * applications) gets it at once. Narrows on body text (HTML stripped) + author
 * name; edit still targets the note's ORIGINAL index in the full list after a
 * search narrows what is rendered (openEdit/onEditNote key off that index).
 */
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

describe('NotesTab · search', () => {
  it('shows every note until something is typed', () => {
    render(<NotesTab notes={[note({ text: '<p>Hello world</p>' }), note({ text: '<p>Bye</p>', author: 'Tom' })]}
      labels={labels} showTimeline={false} showConversations={false} />)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.getByText('Bye')).toBeInTheDocument()
  })

  it('narrows on the note BODY text (HTML stripped before matching)', async () => {
    const user = userEvent.setup()
    render(<NotesTab notes={[note({ text: '<p>Hello world</p>' }), note({ text: '<p>Bye</p>', author: 'Tom' })]}
      labels={labels} showTimeline={false} showConversations={false} />)
    await user.type(screen.getByPlaceholderText('Zoek notities…'), 'hello')
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.queryByText('Bye')).toBeNull()
  })

  it('narrows on the AUTHOR name', async () => {
    const user = userEvent.setup()
    render(<NotesTab notes={[note({ text: '<p>Hello world</p>', author: 'Eva' }), note({ text: '<p>Bye</p>', author: 'Tom' })]}
      labels={labels} showTimeline={false} showConversations={false} />)
    await user.type(screen.getByPlaceholderText('Zoek notities…'), 'tom')
    expect(screen.getByText('Bye')).toBeInTheDocument()
    expect(screen.queryByText('Hello world')).toBeNull()
  })

  it('shows the empty state when nothing matches', async () => {
    const user = userEvent.setup()
    render(<NotesTab notes={[note()]} labels={labels} showTimeline={false} showConversations={false} />)
    await user.type(screen.getByPlaceholderText('Zoek notities…'), 'zzz-no-match')
    expect(screen.getByText('Geen notities')).toBeInTheDocument()
  })

  it('a filtered note\'s edit pencil still targets its ORIGINAL index in the full list', async () => {
    const user = userEvent.setup()
    const onEditNote = vi.fn()
    render(<NotesTab
      notes={[note({ text: '<p>First</p>', author: 'Eva' }), note({ text: '<p>Second</p>', author: 'Tom' }), note({ text: '<p>Third</p>', author: 'Ann' })]}
      labels={labels} onEditNote={onEditNote} showTimeline={false} showConversations={false} />)
    // Narrow to the THIRD note (original index 2) only.
    await user.type(screen.getByPlaceholderText('Zoek notities…'), 'third')
    expect(screen.getByText('Third')).toBeInTheDocument()
    await user.click(screen.getByTitle('Bewerken'))
    // The composer opens pre-filled from onEditNote's own call — assert the INDEX
    // argument, not just that it fired, since that index is what a real host
    // (e.g. CommunicationTab's editUserNote) uses to patch the right record.
    // Triggering the actual save proves which index is bound.
    await user.click(screen.getByTitle('Save'))
    expect(onEditNote).toHaveBeenCalledWith(2, expect.objectContaining({}))
  })

  it('EDIT-PREFILL-1: edit-open seeds the composer from the note — an immediate save carries the ORIGINAL text, never an empty body', async () => {
    // The composer stays mounted across opens; before the remount-key its fields
    // seeded ONCE at page load (empty), so every edit opened blank and a save
    // would have WIPED the note (Danny 08-08 "popup maar geen txt erin").
    const user = userEvent.setup()
    const onEditNote = vi.fn()
    render(<NotesTab notes={[note({ text: '<p>Bestaande tekst</p>', title: 'Belnotitie' })]}
      labels={labels} onEditNote={onEditNote} showTimeline={false} showConversations={false} />)
    await user.click(screen.getByTitle('Bewerken'))
    await user.click(screen.getByTitle('Save'))
    expect(onEditNote).toHaveBeenCalledWith(0, expect.objectContaining({
      title: 'Belnotitie', body: expect.stringContaining('Bestaande tekst'),
    }))
  })
})

// Load-error state (Danny 04-08: retry affordance added HERE, in the shared tab, so
// every host gets it at once — see the four pages/*/drawer/NotesTab.tsx wrappers).
describe('NotesTab · load-error retry', () => {
  it('renders the danger text and a retry button, and calls onRetry on click', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<NotesTab error onRetry={onRetry} labels={{ ...labels, loadError: 'Notes could not be loaded.', retry: 'Try again' }} />)
    expect(screen.getByText('Notes could not be loaded.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders only the static text, no button, when onRetry is omitted (back-compat)', () => {
    render(<NotesTab error labels={{ ...labels, loadError: 'Notes could not be loaded.' }} />)
    expect(screen.getByText('Notes could not be loaded.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('does not render the notes body while in the error state', () => {
    render(<NotesTab error notes={[note()]} labels={{ ...labels, loadError: 'Notes could not be loaded.' }} />)
    expect(screen.queryByText('Hello world')).toBeNull()
  })
})

// Timeline section (candidates' + customers' Tijdlijn sub-tab, Danny 05-08): raw
// ISO strings rendered and the dots had no connecting line. Regression-guarded here
// since both hosts render THIS shared block, not their own fork.
// Ownership gate (RECHTEN-DETAIL-1, Danny 06-08 "notitie-eigenaarschap"): edit/delete
// render only for the note's own author or a manage_all permission holder — the BE
// 403s otherwise, so the FE must never show a button that will fail.
describe('NotesTab · rights (RECHTEN-DETAIL-1)', () => {
  const rightsLabels = { ...labels, deleteNote: 'Verwijderen' }

  it('shows edit + delete on the CURRENT USER\'s own note', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' }, hasPermission: () => false })
    render(<NotesTab notes={[note({ author_id: 'u1' })]} labels={rightsLabels}
      onEditNote={vi.fn()} onDeleteNote={vi.fn()} showTimeline={false} showConversations={false} />)
    expect(screen.getByTitle('Bewerken')).toBeInTheDocument()
    expect(screen.getByTitle('Verwijderen')).toBeInTheDocument()
  })

  it('hides edit + delete on SOMEONE ELSE\'s note without manage_all', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' }, hasPermission: () => false })
    render(<NotesTab notes={[note({ author_id: 'u2' })]} labels={rightsLabels}
      onEditNote={vi.fn()} onDeleteNote={vi.fn()} showTimeline={false} showConversations={false} />)
    expect(screen.queryByTitle('Bewerken')).toBeNull()
    expect(screen.queryByTitle('Verwijderen')).toBeNull()
  })

  it('a manage_all holder sees edit + delete on EVERY note, including a legacy null-author one', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' }, hasPermission: (p: string) => p === 'candidates.notes.manage_all' })
    render(<NotesTab
      notes={[note({ author_id: 'u2' }), note({ text: '<p>Legacy</p>', author_id: null })]}
      labels={rightsLabels} onEditNote={vi.fn()} onDeleteNote={vi.fn()} showTimeline={false} showConversations={false} />)
    expect(screen.getAllByTitle('Bewerken')).toHaveLength(2)
    expect(screen.getAllByTitle('Verwijderen')).toHaveLength(2)
  })

  it('a SYSTEM note never gets edit/delete, even for a manage_all holder', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' }, hasPermission: () => true })
    render(<NotesTab
      systemNotes={[note({ type: 'status_change', author_id: null, text: '<p>Status changed</p>' })]}
      labels={rightsLabels} onEditNote={vi.fn()} onDeleteNote={vi.fn()} showNotes={false} showConversations={false} />)
    expect(screen.getByText('Status changed')).toBeInTheDocument()
    expect(screen.queryByTitle('Bewerken')).toBeNull()
    expect(screen.queryByTitle('Verwijderen')).toBeNull()
  })

  it('keeps the OLD unrestricted behaviour for a host that sends no author_id at all', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' }, hasPermission: () => false })
    render(<NotesTab notes={[note()]} labels={rightsLabels}
      onEditNote={vi.fn()} onDeleteNote={vi.fn()} showTimeline={false} showConversations={false} />)
    expect(screen.getByTitle('Bewerken')).toBeInTheDocument()
    expect(screen.getByTitle('Verwijderen')).toBeInTheDocument()
  })

  it('clicking delete stages the shared confirm dialog and only calls onDeleteNote on confirm', async () => {
    const user = userEvent.setup()
    const onDeleteNote = vi.fn()
    mockUseAuth.mockReturnValue({ user: { id: 'u1' }, hasPermission: () => false })
    render(<NotesTab notes={[note({ author_id: 'u1' })]} labels={{ ...rightsLabels, deleteConfirm: 'Delete this note?' }}
      onEditNote={vi.fn()} onDeleteNote={onDeleteNote} showTimeline={false} showConversations={false} />)
    await user.click(screen.getByTitle('Verwijderen'))
    expect(onDeleteNote).not.toHaveBeenCalled()
    expect(screen.getByText('Delete this note?')).toBeInTheDocument()
    // ConfirmDialog's own buttons fall back to the raw i18next key (no instance in
    // this test tree) — "confirm", not "Confirm"; see ConfirmDialog.tsx.
    await user.click(screen.getByRole('button', { name: 'confirm' }))
    expect(onDeleteNote).toHaveBeenCalledWith(0)
  })
})

/**
 * NOTE-FILTERS-1 / NOTES-DOC-FILTER-MENU-1 (Danny 08-08): the type + channel
 * filters moved from two inline dropdowns next to search into the shared
 * DrawerFilterMenu popover — filtering BEHAVIOUR is unchanged (same narrowing as
 * the old inline SelectMenus), only where the controls live changed. No real
 * i18next instance is bootstrapped in this file (matches every other describe
 * block above), so `t()` calls without a `defaultValue` fall back to the raw key.
 */
describe('NotesTab · type/channel filter menu (NOTE-FILTERS-1)', () => {
  const filterLabels = { ...labels, type: 'Type', channel: 'Kanaal' }
  const noteTypes = [{ value: 'call', label: 'Bellen' }, { value: 'email', label: 'E-mail' }]
  const channels = [{ value: 'phone', label: 'Telefoon' }, { value: 'whatsapp', label: 'WhatsApp' }]

  it('the toolbar no longer renders the type/channel dropdowns inline — only ONE Filter button', () => {
    render(<NotesTab notes={[note()]} labels={filterLabels} noteTypes={noteTypes} channels={channels}
      showTimeline={false} showConversations={false} />)
    // The old inline placeholders are gone from the toolbar row entirely.
    expect(screen.queryByText('Alle types')).toBeNull()
    expect(screen.queryByText('Alle kanalen')).toBeNull()
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
    await user.click(screen.getByRole('button', { name: 'Alle types' }))
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
    await user.click(screen.getByRole('button', { name: 'Alle kanalen' }))
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
    await user.click(screen.getByRole('button', { name: 'Alle types' }))
    await user.click(screen.getByRole('button', { name: 'Bellen' }))
    await user.click(screen.getByRole('button', { name: 'Alle kanalen' }))
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

describe('NotesTab · timeline', () => {
  const timelineItem = (over: Record<string, unknown> = {}) => ({ time: '2026-08-04T17:30:00+00:00', text: 'Fase gewijzigd', ...over })

  it('routes the event time through the house formatter — never the raw ISO field', () => {
    render(<NotesTab timeline={[timelineItem()]} showNotes={false} showConversations={false} labels={labels} />)
    // NOTES-TIMELINE-CONVERGE-1: EventTimeline shows formatTime on the row and
    // keeps the full formatDateTime as the row's hover title.
    expect(screen.getByText('t(2026-08-04T17:30:00+00:00)')).toBeInTheDocument()
    expect(screen.getByTitle('dt(2026-08-04T17:30:00+00:00)')).toBeInTheDocument()
    expect(screen.queryByText('2026-08-04T17:30:00+00:00')).toBeNull()
  })

  it('falls back to created_at when the event carries no `time`', () => {
    render(<NotesTab timeline={[timelineItem({ time: undefined, created_at: '2026-08-01' })]} showNotes={false} showConversations={false} labels={labels} />)
    expect(screen.getByText('t(2026-08-01)')).toBeInTheDocument()
  })

  it('draws no dangling connector after a single event', () => {
    render(<NotesTab timeline={[timelineItem()]} showNotes={false} showConversations={false} labels={labels} />)
    expect(screen.getByTestId('timeline-dot')).toBeInTheDocument()
    expect(screen.queryByTestId('timeline-connector')).toBeNull()
  })

  it('renders a system event through the shared EventTimeline and its marker still opens the changelog', async () => {
    const user = userEvent.setup()
    const openChangelog = vi.fn()
    window.addEventListener('km:open-changelog', openChangelog)
    render(<NotesTab
      systemNotes={[{ type: 'status_change', created_at: '2026-08-04T09:00:00+00:00', text: '<p>Status changed</p>' }]}
      showNotes={false} showConversations={false} labels={{ ...labels, openChangelog: 'Open changelog' }} />)
    expect(screen.getByText('Status changed')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open changelog' }))
    expect(openChangelog).toHaveBeenCalledTimes(1)
    window.removeEventListener('km:open-changelog', openChangelog)
  })

  it('merges system events and timeline items into one chronological list', () => {
    render(<NotesTab
      systemNotes={[{ type: 'status_change', created_at: '2026-08-05T09:00:00+00:00', text: 'Newer system event' }]}
      timeline={[timelineItem({ text: 'Older timeline item', time: '2026-08-01T09:00:00+00:00' })]}
      showNotes={false} showConversations={false} labels={labels} />)
    const rows = screen.getAllByTestId('timeline-dot')
    expect(rows).toHaveLength(2)
    // The system event (05-08) renders before the older timeline item (01-08).
    const order = screen.getByText('Newer system event').compareDocumentPosition(screen.getByText('Older timeline item'))
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('connects every event except the last', () => {
    render(<NotesTab
      timeline={[timelineItem({ text: 'a' }), timelineItem({ text: 'b' }), timelineItem({ text: 'c' })]}
      showNotes={false} showConversations={false} labels={labels} />)
    expect(screen.getAllByTestId('timeline-dot')).toHaveLength(3)
    expect(screen.getAllByTestId('timeline-connector')).toHaveLength(2)
  })
})

/**
 * NOTITIE-POPOUT-HANDOFF-1 (Danny 09/10-08 "werking hetzelfde als icon
 * profieltekst"): popping out from the composer is a HANDOFF — the text MOVES to
 * the second screen and this composer closes only once that screen confirms it has
 * it. Two editors for one thread means whichever you typed in last silently wins;
 * closing before the transfer landed means the text is simply gone. Both are text
 * loss, so both are asserted here.
 */
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

