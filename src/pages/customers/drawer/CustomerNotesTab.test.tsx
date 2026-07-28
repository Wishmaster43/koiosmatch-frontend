/**
 * CustomerNotesTab — this tab is notes and timeline, nothing else. It briefly carried a
 * "+ Nieuwe taak" trigger because GET /tasks?customer= ignored its filter, so a real
 * Taken tab could not be built; that filter works now and Danny had it removed
 * ("hoort hier niet"). This test holds that line: no task trigger, no task modal.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
