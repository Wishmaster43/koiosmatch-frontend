/**
 * NotesTab · search (Danny 03-08: "bij notities wil ik ook een zoekbalk hebben").
 * Added in the SHARED component so every host (candidates/customers/opportunities/
 * applications) gets it at once. Narrows on body text (HTML stripped) + author
 * name; edit still targets the note's ORIGINAL index in the full list after a
 * search narrows what is rendered (openEdit/onEditNote key off that index).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotesTab from './NotesTab'
import { noteDraftTopic } from '@/lib/secondScreen'

// The second-screen window opener — jsdom's window.open does nothing useful, and
// the handoff needs to distinguish "window opened" from "popup blocked".
const { openNotesPopoutMock } = vi.hoisted(() => ({ openNotesPopoutMock: vi.fn() }))
vi.mock('@/lib/secondScreen', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/secondScreen')>()),
  openNotesPopout: openNotesPopoutMock,
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
  useDateFormat: () => ({ formatDate: (v: string) => `d(${v})`, formatDateTime: (v?: string | null) => (v ? `dt(${v})` : '—') }),
}))
// Auth mock (RECHTEN-DETAIL-1 rights gate below) — module-level, mirrors the
// GeocodeButton/SmSyncButton convention so vi.mock's hoist never races the
// `const` it closes over. Defaults to "no user" so every OTHER describe block
// in this file (search/error/timeline) renders exactly as before — none of
// their notes carry author_id, so canManageNote short-circuits to permissive
// regardless of what this mock returns.
const mockUseAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
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
 * NOTITIE-POPOUT-BAR-1 (Danny 09-08 "kan je hier de pop-out ook bijzetten?"): the
 * second-screen button sits in the notes TOOLBAR. It is gated on the host wiring
 * `popout` — i.e. on an entity that really owns a `/popout/notes/{entity}/{id}`
 * route — so an entity without one (applications/matches/tasks/opportunities, scoped
 * location/department notes) never gets a button that would open an empty window (§3).
 * No real i18next instance runs in this file, so `t('openSecondScreen')` falls back
 * to the raw key.
 */
describe('NotesTab · toolbar pop-out (NOTITIE-POPOUT-BAR-1)', () => {
  const target = { entity: 'candidate' as const, id: 'c1' }
  beforeEach(() => openNotesPopoutMock.mockReturnValue({} as Window))

  it('renders the pop-out button when the host named a popout target (entity WITH a route)', () => {
    render(<NotesTab notes={[note()]} labels={labels} popout={target}
      showTimeline={false} showConversations={false} />)
    expect(screen.getByRole('button', { name: 'openSecondScreen' })).toBeInTheDocument()
  })

  it('renders NO pop-out button for a host that named none (entity WITHOUT a popout route)', () => {
    render(<NotesTab notes={[note()]} labels={labels} showTimeline={false} showConversations={false} />)
    expect(screen.queryByRole('button', { name: 'openSecondScreen' })).toBeNull()
  })

  it('renders NO pop-out button inside the popped-out window itself (no self-reopening)', () => {
    render(<NotesTab notes={[note()]} labels={labels} popout={{ ...target, role: 'window' }}
      showTimeline={false} showConversations={false} />)
    expect(screen.queryByRole('button', { name: 'openSecondScreen' })).toBeNull()
  })

  it('clicking it opens that record\'s window once — without opening the composer', async () => {
    const user = userEvent.setup()
    render(<NotesTab notes={[note()]} labels={labels} popout={target}
      showTimeline={false} showConversations={false} />)
    await user.click(screen.getByRole('button', { name: 'openSecondScreen' }))
    expect(openNotesPopoutMock).toHaveBeenCalledWith('candidate', 'c1')
    // The composer (FloatingPanel) must stay shut — this is a "read it elsewhere"
    // action, not a "write a note" one.
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('does not render it on a notes-less section (timeline-only host render)', () => {
    render(<NotesTab timeline={[{ time: '2026-08-04T17:30:00+00:00', text: 'Fase gewijzigd' }]}
      labels={labels} popout={target} showNotes={false} showConversations={false} />)
    expect(screen.queryByRole('button', { name: 'openSecondScreen' })).toBeNull()
  })
})

describe('NotesTab · timeline', () => {
  const timelineItem = (over: Record<string, unknown> = {}) => ({ time: '2026-08-04T17:30:00+00:00', text: 'Fase gewijzigd', ...over })

  it('routes the event time through formatDateTime — never the raw ISO field', () => {
    render(<NotesTab timeline={[timelineItem()]} showNotes={false} showConversations={false} labels={labels} />)
    expect(screen.getByText('dt(2026-08-04T17:30:00+00:00)')).toBeInTheDocument()
    expect(screen.queryByText('2026-08-04T17:30:00+00:00')).toBeNull()
  })

  it('falls back to created_at when the event carries no `time`', () => {
    render(<NotesTab timeline={[timelineItem({ time: undefined, created_at: '2026-08-01' })]} showNotes={false} showConversations={false} labels={labels} />)
    expect(screen.getByText('dt(2026-08-01)')).toBeInTheDocument()
  })

  it('draws no dangling connector after a single event', () => {
    render(<NotesTab timeline={[timelineItem()]} showNotes={false} showConversations={false} labels={labels} />)
    expect(screen.getByTestId('timeline-dot')).toBeInTheDocument()
    expect(screen.queryByTestId('timeline-connector')).toBeNull()
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
  // The composer's OWN pop-out icon (the toolbar one renders first in the DOM).
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
