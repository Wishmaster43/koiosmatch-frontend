/**
 * NotesTab · search (Danny 03-08: "bij notities wil ik ook een zoekbalk hebben").
 * Added in the SHARED component so every host (candidates/customers/opportunities/
 * applications) gets it at once. Narrows on body text (HTML stripped) + author
 * name; edit still targets the note's ORIGINAL index in the full list after a
 * search narrows what is rendered (openEdit/onEditNote key off that index).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotesTab from './NotesTab'

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
 * second-screen button now sits in the notes TOOLBAR, not only inside the composer's
 * FloatingPanel header. It is gated on the host wiring `onPopOut` — i.e. on an entity
 * that really owns a `/popout/notes/{entity}/{id}` route — so an entity without one
 * (applications/matches/tasks/opportunities, scoped location/department notes) never
 * gets a button that would open an empty window (§3). No real i18next instance runs in
 * this file, so `t('openSecondScreen')` falls back to the raw key.
 */
describe('NotesTab · toolbar pop-out (NOTITIE-POPOUT-BAR-1)', () => {
  it('renders the pop-out button when the host wired onPopOut (entity WITH a popout route)', () => {
    render(<NotesTab notes={[note()]} labels={labels} onPopOut={vi.fn()}
      showTimeline={false} showConversations={false} />)
    expect(screen.getByRole('button', { name: 'openSecondScreen' })).toBeInTheDocument()
  })

  it('renders NO pop-out button for a host that wired none (entity WITHOUT a popout route)', () => {
    render(<NotesTab notes={[note()]} labels={labels} showTimeline={false} showConversations={false} />)
    expect(screen.queryByRole('button', { name: 'openSecondScreen' })).toBeNull()
  })

  it('clicking it calls the host handler once — without opening the composer', async () => {
    const user = userEvent.setup()
    const onPopOut = vi.fn()
    render(<NotesTab notes={[note()]} labels={labels} onPopOut={onPopOut}
      showTimeline={false} showConversations={false} />)
    await user.click(screen.getByRole('button', { name: 'openSecondScreen' }))
    expect(onPopOut).toHaveBeenCalledTimes(1)
    // The composer (FloatingPanel) must stay shut — this is a "read it elsewhere"
    // action, not a "write a note" one.
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('does not render it on a notes-less section (timeline-only host render)', () => {
    render(<NotesTab timeline={[{ time: '2026-08-04T17:30:00+00:00', text: 'Fase gewijzigd' }]}
      labels={labels} onPopOut={vi.fn()} showNotes={false} showConversations={false} />)
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

// POPOUT-HANDOFF-1 (Danny 09-08): popping out from the composer is a HANDOFF —
// the modal closes and the second screen takes over. Two open editors for one
// thread means whichever you typed in last silently wins.
describe('NotesTab · pop-out from the composer hands over', () => {
  it('closes the composer and opens the second screen in one action', async () => {
    const user = userEvent.setup()
    const onPopOut = vi.fn()
    render(<NotesTab notes={[note()]} labels={labels} showTimeline={false} showConversations={false}
      onPopOut={onPopOut} />)

    await user.click(screen.getByRole('button', { name: labels.newNote }))
    // Toolbar pop-out renders first, the composer's own last — click the composer's.
    // This suite runs without real i18n, so t() yields the bare key.
    const popOuts = screen.getAllByRole('button', { name: 'openSecondScreen' })
    await user.click(popOuts[popOuts.length - 1])

    expect(onPopOut).toHaveBeenCalledTimes(1)
    // The composer is gone — not left open behind the new window.
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
