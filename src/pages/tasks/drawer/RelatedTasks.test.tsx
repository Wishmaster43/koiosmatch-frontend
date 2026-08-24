import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RelatedTasks from './RelatedTasks'
// TASK-DISPLAY-DRILL-1: flat settings mock — defaults on, so existing
// assertions keep seeing coloured chips.
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => ({}),
  getBoolSetting: (_s: unknown, _key: string, fallback: boolean) => fallback,
}))

import type { TaskDetail, TaskLink } from '@/types/task'

// Keep the real unwrap/unwrapList (importActual) — only the default client is
// stubbed. Mirrors this drawer's own NotesTab.test.tsx (own-fetch tab pattern).
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: [] })) } }
})
// Stub useDateFormat — a plain identity formatter keeps assertions on the raw value.
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v }) }))
// T5 lookups come from the tenant — a small fixed set, no provider needed.
// TASK-FILTER-MENU-1: types/priorities added alongside statuses (empty by
// default here — the individual filter-menu tests below opt in per-case).
vi.mock('@/context/TaskLookupsContext', () => ({
  useTaskLookups: () => ({
    // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colours (DATA, not UI styling)
    statuses: [{ value: 's-todo', label: 'Te doen', color: '#888888' }, { value: 's-done', label: 'Afgerond', color: '#00aa00' }],
    // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colours (DATA, not UI styling)
    types: [{ value: 't-call', label: 'Belafspraak', color: '#5FB0AC' }],
    // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colours (DATA, not UI styling)
    priorities: [{ value: 'p-high', label: 'Hoog', color: '#D98A8A' }],
  }),
}))

import api from '@/lib/api'
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

const task = (over: Partial<TaskDetail> = {}) => ({
  id: 't1', assigneeId: null, links: [{ type: 'candidate', id: 'c1', label: 'Anna' } as TaskLink], ...over,
} as unknown as TaskDetail)

describe('RelatedTasks (task drawer, T5: generalised beyond candidate-only)', () => {
  it('renders nothing and fetches nothing when the task has no qualifying link AND no assignee', () => {
    mockGet.mockClear()
    const { container } = render(<RelatedTasks task={task({ links: [], assigneeId: null })} />)
    expect(container).toBeEmptyDOMElement()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('fetches the CANDIDATE link\'s tasks (own task filtered out) and shows the empty state', async () => {
    mockGet.mockClear()
    render(<RelatedTasks task={task()} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/tasks', { params: { candidate: 'c1' } }))
    expect(await screen.findByText('related.empty')).toBeInTheDocument()
    expect(screen.getByText('related.titles.candidate')).toBeInTheDocument()
  })

  it('fetches the CUSTOMER link\'s tasks with the right title when linked to a customer instead', async () => {
    mockGet.mockClear()
    render(<RelatedTasks task={task({ links: [{ type: 'customer', id: 'cu1', label: 'Acme' } as TaskLink] })} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/tasks', { params: { customer: 'cu1' } }))
    expect(screen.getByText('related.titles.customer')).toBeInTheDocument()
  })

  it.each([
    ['location', 'loc1'],
    ['department', 'dep1'],
    ['contact', 'con1'],
  ] as const)('fetches the %s link\'s tasks under its own filter param', async (type, id) => {
    mockGet.mockClear()
    render(<RelatedTasks task={task({ links: [{ type, id, label: 'X' } as TaskLink] })} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/tasks', { params: { [type]: id } }))
  })

  it('falls back to the RECRUITER/USER (assignee) when the task carries none of the supported link types', async () => {
    mockGet.mockClear()
    render(<RelatedTasks task={task({ links: [{ type: 'vacancy', id: 'v1', label: 'Vac' } as TaskLink], assigneeId: 'u1' })} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/tasks', { params: { assignee_id: ['u1'] } }))
    expect(screen.getByText('related.titles.assignee')).toBeInTheDocument()
  })

  it('prioritises a qualifying link over the assignee fallback', async () => {
    mockGet.mockClear()
    render(<RelatedTasks task={task({ links: [{ type: 'candidate', id: 'c1', label: 'Anna' } as TaskLink], assigneeId: 'u1' })} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/tasks', { params: { candidate: 'c1' } }))
  })

  // §3 — a failed load must surface its OWN state, never silently read as "no
  // related tasks" (the bug this file was audited for, carried through T5).
  it('shows a distinct error state — not the empty state — when the load fails', async () => {
    mockGet.mockClear()
    mockGet.mockRejectedValueOnce({ response: { status: 500 } })
    render(<RelatedTasks task={task()} />)
    expect(await screen.findByText('related.error')).toBeInTheDocument()
    expect(screen.queryByText('related.empty')).toBeNull()
  })

  it('retries the same GET when the retry button is clicked', async () => {
    mockGet.mockClear()
    mockGet.mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValueOnce({ data: [] })
    const user = userEvent.setup()
    render(<RelatedTasks task={task()} />)
    expect(await screen.findByText('related.error')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'common:error.retry' }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    expect(mockGet).toHaveBeenNthCalledWith(2, '/tasks', { params: { candidate: 'c1' } })
    expect(await screen.findByText('related.empty')).toBeInTheDocument()
  })

  it('renders related task rows on success, filtering the current task out', async () => {
    mockGet.mockClear()
    mockGet.mockResolvedValueOnce({ data: [
      { id: 't1', title: 'Should be filtered out (self)' },
      // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colour (DATA, not UI styling)
      { id: 't2', title: 'Bel kandidaat terug', status: { label: 'Open', color: '#888888' } },
    ] })
    render(<RelatedTasks task={task()} />)
    expect(await screen.findByText('Bel kandidaat terug')).toBeInTheDocument()
    expect(screen.queryByText('Should be filtered out (self)')).toBeNull()
  })

  it('re-fetches with q= once the search box settles', async () => {
    mockGet.mockClear()
    const user = userEvent.setup()
    render(<RelatedTasks task={task()} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/tasks', { params: { candidate: 'c1' } }))
    await user.type(screen.getByPlaceholderText('related.searchPlaceholder'), 'bellen')
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('/tasks', { params: { candidate: 'c1', q: 'bellen' } }))
  })

  it('re-fetches with status= once a status is toggled on, and unchecking it clears the param again', async () => {
    mockGet.mockClear()
    const user = userEvent.setup()
    render(<RelatedTasks task={task()} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/tasks', { params: { candidate: 'c1' } }))
    // TASK-FILTER-MENU-1: the status picker now lives behind the shared Filter button.
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('checkbox', { name: 'Te doen' }))
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('/tasks', { params: { candidate: 'c1', status: ['s-todo'] } }))
    // Unchecking the same box clears the filter and re-fetches without `status`.
    await user.click(screen.getByRole('checkbox', { name: 'Te doen' }))
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('/tasks', { params: { candidate: 'c1' } }))
  })
})

/**
 * TASK-FILTER-MENU-1 (Danny 08-08): type + priority — same server-side
 * multi-select shape as status, added alongside it in the SAME filter panel.
 */
describe('RelatedTasks · type/priority filter menu (TASK-FILTER-MENU-1)', () => {
  it('re-fetches with type= once a type is toggled on', async () => {
    mockGet.mockClear()
    const user = userEvent.setup()
    render(<RelatedTasks task={task()} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/tasks', { params: { candidate: 'c1' } }))
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('checkbox', { name: 'Belafspraak' }))
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('/tasks', { params: { candidate: 'c1', type: ['t-call'] } }))
  })

  it('re-fetches with priority= once a priority is toggled on', async () => {
    mockGet.mockClear()
    const user = userEvent.setup()
    render(<RelatedTasks task={task()} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/tasks', { params: { candidate: 'c1' } }))
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('checkbox', { name: 'Hoog' }))
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('/tasks', { params: { candidate: 'c1', priority: ['p-high'] } }))
  })

  it('the toolbar no longer renders a standing status dropdown — only ONE Filter button', async () => {
    render(<RelatedTasks task={task()} />)
    expect(screen.queryByRole('button', { name: /filters\.choose|filters\.selectedCount/ })).toBeNull()
    expect(await screen.findByRole('button', { name: 'Filter' })).toBeInTheDocument()
  })

  it('the badge counts every active selection, and clear-all resets the fetch to no filters', async () => {
    mockGet.mockClear()
    const user = userEvent.setup()
    render(<RelatedTasks task={task()} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/tasks', { params: { candidate: 'c1' } }))
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('checkbox', { name: 'Te doen' }))
    await user.click(screen.getByRole('checkbox', { name: 'Hoog' }))
    expect(screen.getByText('2')).toBeInTheDocument()
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('/tasks', { params: { candidate: 'c1', status: ['s-todo'], priority: ['p-high'] } }))

    await user.click(screen.getByRole('button', { name: 'common:filters.clearAll' }))
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('/tasks', { params: { candidate: 'c1' } }))
  })

  it('Escape closes the filter panel', async () => {
    const user = userEvent.setup()
    render(<RelatedTasks task={task()} />)
    await user.click(await screen.findByRole('button', { name: 'Filter' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
