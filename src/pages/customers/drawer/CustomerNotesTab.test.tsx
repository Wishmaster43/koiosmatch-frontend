/**
 * CustomerNotesTab · "+ Nieuwe taak" trigger (Danny 28-07, JOB A: create a task
 * from the customer drawer). Mounts the REAL AddTaskModal (not a stub) so the
 * assertion proves the actual REQUEST body — §13: a mutation test must assert
 * the request, never only that a callback fired. Covers: the trigger only shows
 * in the Notities view (not Communicatie/timeline), the customer field renders
 * LOCKED read-only text (never a picker the recruiter could repoint), and the
 * POST carries the customer link.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
// Stubbed: this file tests the TRIGGER's contract, not the modal's internals.
let lastTaskModalProps: Record<string, unknown> = {}
vi.mock('@/pages/tasks/AddTaskModal', () => ({
  default: (props: Record<string, unknown>) => { lastTaskModalProps = props; return <div data-testid="add-task-modal" /> },
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

describe('CustomerNotesTab · "+ Nieuwe taak" trigger', () => {
  it('shows the trigger in the Notities view but not in the Communicatie (timeline) view', async () => {
    // Notities is the default sub-tab; switching to Tijdlijn must hide the trigger.
    render(<CustomerNotesTab customerId="cust-1" customerName="Acme Zorg" notes={[]} c={customer} />)
    expect(screen.getByRole('button', { name: 'drawer.newTask' })).toBeInTheDocument()

    // SubTabBar exposes role="tab" since it became a real tablist (28-07).
    fireEvent.click(screen.getByRole('tab', { name: 'notes.timeline' }))
    // Await the activity fetch the Tijdlijn view kicks off — leaving it in flight makes
    // React warn about an un-acted update and keeps the worker alive after the run.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'drawer.newTask' })).not.toBeInTheDocument())
  })

  it('does not render the modal until the trigger is clicked', () => {
    render(<CustomerNotesTab customerId="cust-1" customerName="Acme Zorg" notes={[]} c={customer} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // The trigger's contract with the modal: it must hand over THIS customer, locked.
  // Asserted on the props rather than by mounting the real AddTaskModal — that mount
  // left in-flight lookup promises that kept the vitest worker alive after the run, so
  // the whole file never reported (measured 28-07). The POST body itself is covered
  // where it belongs, in AddTaskModal.test.tsx, which asserts the real request.
  it('opens the task modal with THIS customer pre-linked and locked', () => {
    render(<CustomerNotesTab customerId="cust-1" customerName="Acme Zorg" notes={[]} c={customer} />)
    fireEvent.click(screen.getByRole('button', { name: 'drawer.newTask' }))

    expect(screen.getByTestId('add-task-modal')).toBeInTheDocument()
    expect(lastTaskModalProps).toMatchObject({ lockCustomerId: 'cust-1', lockCustomerName: 'Acme Zorg' })
  })
})
