import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LinksTab from './LinksTab'
import type { TaskDetail } from '@/types/task'

// Only the default client is stubbed — mirrors this drawer's own
// RelatedTasks.test.tsx / NotesTab.test.tsx (own-fetch pattern).
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: [] })) } }
})

import api from '@/lib/api'
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

const task = (over: Partial<TaskDetail> = {}) => ({ id: 't1', links: [], ...over } as unknown as TaskDetail)

describe('LinksTab — add-link entity picker (audit finding 2026-08-05: four UI states)', () => {
  it('shows the empty state when the task has no links', () => {
    render(<LinksTab task={task()} onAddLink={vi.fn()} onRemoveLink={vi.fn()} />)
    expect(screen.getByText('links.empty')).toBeInTheDocument()
  })

  it('fetches candidates for the default type once the add row opens', async () => {
    mockGet.mockClear()
    const user = userEvent.setup()
    render(<LinksTab task={task()} onAddLink={vi.fn()} onRemoveLink={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'links.add' }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/candidates', { params: { q: '', search: '', per_page: 25 } }))
  })

  // §3 — a failed entity search must surface its OWN error line, distinct from
  // "no matches for this search" (the bug this file was audited for: the old
  // `.catch(() => {})` silently left the picker at zero options).
  it('shows a distinct error line when the entity search fails', async () => {
    mockGet.mockClear()
    mockGet.mockRejectedValueOnce({ response: { status: 500 } })
    const user = userEvent.setup()
    render(<LinksTab task={task()} onAddLink={vi.fn()} onRemoveLink={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'links.add' }))
    expect(await screen.findByText('links.loadError')).toBeInTheDocument()
  })

  // §13 — a request test must assert the REQUEST, not only that a callback fired:
  // the retry button must re-issue the exact same GET.
  it('retries the same GET when the retry button is clicked', async () => {
    mockGet.mockClear()
    mockGet.mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValueOnce({ data: [] })
    const user = userEvent.setup()
    render(<LinksTab task={task()} onAddLink={vi.fn()} onRemoveLink={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'links.add' }))
    expect(await screen.findByText('links.loadError')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'common:error.retry' }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    expect(mockGet).toHaveBeenNthCalledWith(2, '/candidates', { params: { q: '', search: '', per_page: 25 } })
    expect(screen.queryByText('links.loadError')).toBeNull()
  })
})
