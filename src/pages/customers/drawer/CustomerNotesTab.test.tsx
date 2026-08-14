/**
 * CustomerNotesTab — notes, tasks, timeline and vacancy visibility under one
 * Communicatie roof. Two Danny decisions coexist here and do NOT conflict:
 * 28-07 removed the naked "+ Nieuwe taak" trigger from the Notities view ("hoort
 * hier niet" — a create-only button without a list was the most that was honest),
 * and 03-08 moved the FULL Taken tab (list + search/status toolbar + add) in as
 * its own sub-tab. So: no task trigger on Notities, a complete tasks surface one
 * sub-tab over. Both lines are held by tests below.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import CustomerNotesTab from './CustomerNotesTab'
import api from '@/lib/api'

vi.mock('@/lib/useNoteTypes', () => ({ useNoteTypes: () => ({ types: [], writableTypes: [] }) }))
vi.mock('@/lib/mocks', () => ({ isAbortError: () => false }))
// The shared NotesTab pulls in @/lib/datetime, which imports the REAL i18n runtime
// as a side effect — mocked here (mirrors OpportunitiesTab.test.tsx) so t() keeps
// echoing raw keys instead of silently switching every assertion to live NL copy.
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v, formatTime: (v: string) => v, locale: 'nl-NL' }) }))
// TaskLookupsProvider is rendered directly by CustomerNotesTab (not behind a
// hook boundary) — a passthrough here avoids the real provider's own /task-*
// fetches while useTaskLookups still returns stable seed-shaped values.
vi.mock('@/context/TaskLookupsContext', () => ({
  TaskLookupsProvider: ({ children }: { children: ReactNode }) => children,
  useTaskLookups: () => ({
    statuses: [{ value: 'todo', label: 'Te doen', color: '#000' }],
    types: [{ value: 'task', label: 'Taak', color: '#000' }],
    priorities: [{ value: 'normal', label: 'Normaal', color: '#000' }],
    defaultPriority: 'normal',
  }),
}))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
// Stubbed so a stray render would be VISIBLE as a testid rather than mounting the real
// modal (which once hung the whole suite).
vi.mock('@/pages/tasks/AddTaskModal', () => ({
  default: ({ extraLinks }: { extraLinks?: Array<{ type: string; id: string }> }) => (
    <div data-testid="add-task-modal" data-extra-links={JSON.stringify(extraLinks ?? [])} />
  ),
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
// The candidate/customer/contact link pickers each GET their own list; empty
// rows are enough — this test only cares about the LOCKED customer field.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  const get = vi.fn(() => Promise.resolve({ data: { data: [] } }))
  const post = vi.fn(() => Promise.resolve({ data: { data: {} } }))
  return { ...actual, default: { get, post } }
})

// Minimal customer record — only the Vacature-zichtbaarheid sub-tab reads it.
const customer = { id: 'cust-1', name: 'Acme Zorg' } as never

describe('CustomerNotesTab · geen taak-trigger', () => {
  // Danny 28-07: "+ nieuwe taak moet weg, hoort hier niet". It only ever sat on this tab
  // because GET /tasks?customer= ignored its filter, so a real Taken tab could not be
  // built and a create-only button was the most that was honest. That filter works now,
  // so tasks belong in their own tab — this one is notes and timeline, nothing else.
  it('renders no task trigger on the Notities view', () => {
    render(<CustomerNotesTab customerId="cust-1" customerName="Acme Zorg" notes={[]} onAddNote={vi.fn()} c={customer} onSave={vi.fn()} />)
    // t() echoes raw keys here (see the datetime mock), so the key IS the label.
    expect(screen.queryByRole('button', { name: 'drawer.newTask' })).toBeNull()
    expect(screen.queryByTestId('add-task-modal')).toBeNull()
  })
})

/** TAKEN-NAAR-COMMUNICATIE-1 (Danny 03-08): the customer's Taken moved from a
 *  top-level drawer tab into the Communicatie sub-tab bar. */
describe('CustomerNotesTab · Taken sub-tab', () => {
  it('renders the shared tasks tab when the Taken sub-tab is picked', async () => {
    const user = userEvent.setup()
    render(<CustomerNotesTab customerId="cust-1" customerName="Acme Zorg" notes={[]} onAddNote={vi.fn()} c={customer} onSave={vi.fn()} />)
    // t() echoes raw keys here (see the datetime mock), so the key IS the label.
    await user.click(screen.getByText('drawer.tabs.tasks'))
    // The shared tab's own add-trigger proves the real EntityTasksTab mounted.
    expect(await screen.findByRole('button', { name: 'tasks.newTask' })).toBeInTheDocument()
  })
})

/** TAKEN-DOOD-1 (Danny 03-08): "+ nieuwe taak doet niets" on the moved Taken sub-tab. */
describe('CustomerNotesTab · Taken sub-tab opens the task modal', () => {
  it('clicking + Nieuwe taak actually opens AddTaskModal, pre-linked to the customer', async () => {
    const user = userEvent.setup()
    render(<CustomerNotesTab customerId="cust-1" customerName="Acme Zorg" notes={[]} onAddNote={vi.fn()} c={customer} onSave={vi.fn()} />)
    await user.click(screen.getByText('drawer.tabs.tasks'))
    await user.click(await screen.findByRole('button', { name: 'tasks.newTask' }))
    const modal = await screen.findByTestId('add-task-modal')
    expect(JSON.parse(modal.getAttribute('data-extra-links') ?? '[]')).toEqual([{ type: 'customer', id: 'cust-1' }])
  })
})

/** K14 (13-08): the note composer opened FROM a customer's Notities tab shows the
 *  customer's own name in its title — a host-prop into the shared `labels.newNote`
 *  string (NoteComposer.tsx:123 reads `labels.newNote` as the panel title), not a
 *  fork of the shared NoteComposer component. */
describe('CustomerNotesTab · K14 composer title carries the customer name', () => {
  it('shows "notes.newNoteFor" interpolated with the customer name when opening + Nieuwe notitie', async () => {
    const user = userEvent.setup()
    render(<CustomerNotesTab customerId="cust-1" customerName="Acme Zorg" notes={[]} onAddNote={vi.fn()} c={customer} onSave={vi.fn()} />)
    // The "+ Nieuwe notitie" trigger shares the same `labels.newNote` string as
    // the composer title, so its own accessible name already carries the
    // customer-specific key too.
    await user.click(screen.getByRole('button', { name: 'notes.newNoteFor' }))
    // t() echoes the raw KEY here (uninitialised react-i18next, mirrors
    // CustomerNotesPopout.test.tsx's own "popout.windowTitle" assertion) — the
    // proof this test needs is that the customer-name KEY is chosen at all.
    expect(await screen.findByRole('dialog', { name: 'notes.newNoteFor' })).toBeInTheDocument()
  })

  it('falls back to the generic "notes.newNote" title when no customer name is known', async () => {
    const user = userEvent.setup()
    render(<CustomerNotesTab customerId="cust-1" notes={[]} onAddNote={vi.fn()} c={customer} onSave={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'notes.newNote' }))
    expect(await screen.findByRole('dialog', { name: 'notes.newNote' })).toBeInTheDocument()
  })
})

/** K17 (batch 5): the Tijdlijn sub-tab reads the CustomerDetailResource embed
 *  (`c.timeline`) as its PRIMARY source, falling back to GET .../activity only
 *  when the embed is absent (§10 tolerant — the field is not shipped by every
 *  backend yet). These are request-shape regression tests, not just "a callback
 *  fired" (§13). */
describe('CustomerNotesTab · K17 timeline embed vs fallback', () => {
  beforeEach(() => { vi.mocked(api.get).mockClear() })

  it('embed present: renders the embedded events and never GETs /activity', async () => {
    const user = userEvent.setup()
    const withTimeline = { id: 'cust-1', name: 'Acme Zorg', timeline: [{ time: '2026-08-01T10:00:00Z', text: 'Status gewijzigd naar Klant' }] } as never
    render(<CustomerNotesTab customerId="cust-1" customerName="Acme Zorg" notes={[]} onAddNote={vi.fn()} c={withTimeline} onSave={vi.fn()} />)
    await user.click(screen.getByText('notes.timeline'))

    expect(await screen.findByText('Status gewijzigd naar Klant')).toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalledWith(expect.stringContaining('/activity'), expect.anything())
  })

  it('embed absent: falls back to GET /customers/{id}/activity', async () => {
    const user = userEvent.setup()
    vi.mocked(api.get).mockImplementation((url: string) =>
      url.includes('/activity')
        ? Promise.resolve({ data: { data: [{ created_at: '2026-08-01T10:00:00Z', description: 'Klant aangemaakt' }] } })
        : Promise.resolve({ data: { data: [] } }))
    // `customer` (module scope) carries no `timeline` key at all — the absent-embed case.
    render(<CustomerNotesTab customerId="cust-1" customerName="Acme Zorg" notes={[]} onAddNote={vi.fn()} c={customer} onSave={vi.fn()} />)
    await user.click(screen.getByText('notes.timeline'))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/customers/cust-1/activity', expect.anything()))
    expect(await screen.findByText('Klant aangemaakt')).toBeInTheDocument()
  })
})
