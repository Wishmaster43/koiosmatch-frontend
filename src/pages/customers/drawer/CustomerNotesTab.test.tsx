/**
 * CustomerNotesTab — notes, tasks, timeline and vacancy visibility under one
 * Communicatie roof. Two Danny decisions coexist here and do NOT conflict:
 * 28-07 removed the naked "+ Nieuwe taak" trigger from the Notities view ("hoort
 * hier niet" — a create-only button without a list was the most that was honest),
 * and 03-08 moved the FULL Taken tab (list + search/status toolbar + add) in as
 * its own sub-tab. So: no task trigger on Notities, a complete tasks surface one
 * sub-tab over. Both lines are held by tests below.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import CustomerNotesTab from './CustomerNotesTab'

vi.mock('@/lib/useNoteTypes', () => ({ useNoteTypes: () => ({ types: [], writableTypes: [] }) }))
vi.mock('@/lib/mocks', () => ({ isAbortError: () => false }))
// The shared NotesTab pulls in @/lib/datetime, which imports the REAL i18n runtime
// as a side effect — mocked here (mirrors OpportunitiesTab.test.tsx) so t() keeps
// echoing raw keys instead of silently switching every assertion to live NL copy.
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v, locale: 'nl-NL' }) }))
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
  default: () => <div data-testid="add-task-modal" />,
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
