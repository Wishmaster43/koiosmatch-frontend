import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SubtaskQuickView from './SubtaskQuickView'

// TAKEN 3: real unwrap (importActual), only the default client's get/patch are
// stubbed — mirrors SubtasksSection.test.tsx / RelatedTasks.test.tsx's own-fetch
// tab pattern.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn(() => Promise.resolve({ data: {} })) } }
})
import api from '@/lib/api'
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockPatch = api.patch as unknown as ReturnType<typeof vi.fn>

// Identity date formatter — assertions read the raw value (mirrors RelatedTasks.test.tsx).
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v }) }))

// The tenant status vocabulary — a small fixed set, no provider needed.
vi.mock('@/context/TaskLookupsContext', () => ({
  useTaskLookups: () => ({
    statuses: [
      // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colour (DATA, not UI styling)
      { value: 'todo', label: 'Te doen', color: '#888888' },
      // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colour (DATA, not UI styling)
      { value: 'done', label: 'Afgerond', color: '#00aa00' },
    ],
  }),
}))

// Slug→uuid FK map (mirrors useTaskDrawerActions' real resolve path) — stubbed
// directly so this file never needs to also fake /task-statuses etc.
vi.mock('../hooks/useTaskLookupIds', () => ({
  useTaskLookupIds: () => ({ maps: { status: { todo: 'uuid-todo', done: 'uuid-done' }, type: {}, priority: {} }, loading: false }),
}))

const openEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity }) }))

vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const RAW_TASK = {
  id: 'sub-1',
  title: 'Bel terug',
  // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colour (DATA, not UI styling)
  status: { value: 'todo', label: 'Te doen', color: '#888888', is_done: false },
  assignee: { id: 'user-1', name: 'Anna' },
  due_date: '2026-08-25',
  description: '<p>Even nabellen</p>',
}

describe('SubtaskQuickView (TAKEN 3: compact popup instead of the full drawer)', () => {
  it('shows a loading state, then renders title/status/assignee/due on success', async () => {
    mockGet.mockClear()
    mockGet.mockResolvedValueOnce({ data: RAW_TASK })
    render(<SubtaskQuickView id="sub-1" onClose={vi.fn()} />)

    expect(screen.getByText('details.subtasks.loading')).toBeInTheDocument()
    expect(await screen.findByText('Bel terug')).toBeInTheDocument()
    expect(mockGet).toHaveBeenCalledWith('/tasks/sub-1')
    expect(screen.getByText('Te doen')).toBeInTheDocument()
    expect(screen.getByText('Anna')).toBeInTheDocument()
    expect(screen.getByText('2026-08-25')).toBeInTheDocument()
  })

  it('shows a distinct error state, and retry re-fetches the same task', async () => {
    mockGet.mockClear()
    mockGet.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ data: RAW_TASK })
    const user = userEvent.setup()
    render(<SubtaskQuickView id="sub-1" onClose={vi.fn()} />)

    expect(await screen.findByText('details.subtasks.error')).toBeInTheDocument()
    await user.click(screen.getByText('common:error.retry'))
    expect(await screen.findByText('Bel terug')).toBeInTheDocument()
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it('changing the status fires the real PATCH /tasks/{id} with the resolved status_id, and notifies the host', async () => {
    mockGet.mockClear(); mockPatch.mockClear()
    mockGet.mockResolvedValueOnce({ data: RAW_TASK })
    const onChanged = vi.fn()
    const user = userEvent.setup()
    render(<SubtaskQuickView id="sub-1" onClose={vi.fn()} onChanged={onChanged} />)

    await screen.findByText('Bel terug')
    // The trigger's accessible NAME is the FieldRow label now (aria-labelledby
    // wins over content — the Opus a11y fix): the field is findable by what a
    // screen reader actually announces.
    await user.click(screen.getByRole('button', { name: 'details.status' }))
    await user.click(screen.getByRole('button', { name: 'Afgerond' }))

    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/tasks/sub-1', { status_id: 'uuid-done' }))
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('"open as task" navigates to the full drawer and closes the quick view', async () => {
    mockGet.mockClear()
    mockGet.mockResolvedValueOnce({ data: RAW_TASK })
    openEntity.mockClear()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<SubtaskQuickView id="sub-1" onClose={onClose} />)

    await screen.findByText('Bel terug')
    await user.click(screen.getByRole('button', { name: /details\.subtasks\.openFull/ }))

    expect(openEntity).toHaveBeenCalledWith('tasks', 'sub-1')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
