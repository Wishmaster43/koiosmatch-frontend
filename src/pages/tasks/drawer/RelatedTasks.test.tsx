import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RelatedTasks from './RelatedTasks'
import type { TaskDetail, TaskLink } from '@/types/task'

// Keep the real unwrap/unwrapList (importActual) — only the default client is
// stubbed. Mirrors this drawer's own NotesTab.test.tsx (own-fetch tab pattern).
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: [] })) } }
})
// Stub useDateFormat — a plain identity formatter keeps assertions on the raw value.
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v }) }))

import api from '@/lib/api'
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

const task = (over: Partial<TaskDetail> = {}) => ({
  id: 't1', links: [{ type: 'candidate', id: 'c1', label: 'Anna' } as TaskLink], ...over,
} as unknown as TaskDetail)

describe('RelatedTasks (task drawer, audit finding 2026-08-05: four UI states)', () => {
  it('renders nothing and fetches nothing when the task has no candidate link', () => {
    mockGet.mockClear()
    const { container } = render(<RelatedTasks task={task({ links: [] })} />)
    expect(container).toBeEmptyDOMElement()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('fetches the candidate\'s tasks (own task filtered out) and shows the empty state', async () => {
    mockGet.mockClear()
    render(<RelatedTasks task={task()} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/tasks', { params: { candidate: 'c1' } }))
    expect(await screen.findByText('related.empty')).toBeInTheDocument()
  })

  // §3 — a failed load must surface its OWN state, never silently read as "no
  // related tasks" (the bug this file was audited for).
  it('shows a distinct error state — not the empty state — when the load fails', async () => {
    mockGet.mockClear()
    mockGet.mockRejectedValueOnce({ response: { status: 500 } })
    render(<RelatedTasks task={task()} />)
    expect(await screen.findByText('related.error')).toBeInTheDocument()
    expect(screen.queryByText('related.empty')).toBeNull()
  })

  // §13 — a request test must assert the REQUEST, not only that a callback fired:
  // the retry button must re-issue the exact same GET.
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
})
