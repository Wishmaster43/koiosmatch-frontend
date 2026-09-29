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
    // An empty query sends neither q nor search (contract audit ENT2-01: the empty string turns into null and 422s).
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/candidates', { params: { per_page: 25 } }))
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
    expect(mockGet).toHaveBeenNthCalledWith(2, '/candidates', { params: { per_page: 25 } })
    expect(screen.queryByText('links.loadError')).toBeNull()
  })
})

describe('LinksTab — REFERENCE-LINK-1 (dependent on the task\'s own candidate link)', () => {
  const linkedTask = task({ links: [{ type: 'candidate', id: 'cand-1', label: 'Ahmed' }] })

  it('add: picking a reference for a candidate-linked task POSTs { type: "reference", id } exactly', async () => {
    mockGet.mockReset()
    mockGet.mockImplementation((url: string) => url === '/candidates/cand-1/references'
      ? Promise.resolve({ data: [{ id: 'ref-1', name: 'Referentie A' }] })
      : Promise.resolve({ data: [] }))
    const onAddLink = vi.fn()
    const user = userEvent.setup()
    render(<LinksTab task={linkedTask} onAddLink={onAddLink} onRemoveLink={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'links.add' }))
    // The probe confirms the route before `reference` shows in the type dropdown.
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/candidates/cand-1/references', { params: { per_page: 1 }, quietStatuses: [404] }))
    // Open the type picker (its trigger shows the default type's label) and pick "reference".
    await user.click(screen.getByRole('button', { name: /links\.candidate/ }))
    await user.click(await screen.findByText('links.reference'))
    await user.click(screen.getByRole('button', { name: /select/i }))
    await user.click(await screen.findByText('Referentie A'))
    expect(onAddLink).toHaveBeenCalledWith({ type: 'reference', id: 'ref-1', label: 'Referentie A' })
  })

  it('is NOT offered when the light references route 404s', async () => {
    mockGet.mockReset()
    mockGet.mockImplementation((url: string) => url === '/candidates/cand-1/references'
      ? Promise.reject({ response: { status: 404 } })
      : Promise.resolve({ data: [] }))
    const user = userEvent.setup()
    render(<LinksTab task={linkedTask} onAddLink={vi.fn()} onRemoveLink={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'links.add' }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/candidates/cand-1/references', { params: { per_page: 1 }, quietStatuses: [404] }))
    expect(screen.queryByText('links.reference')).toBeNull()
  })

  it('is NOT offered when the task has no candidate link', async () => {
    mockGet.mockReset()
    mockGet.mockResolvedValue({ data: [] })
    const user = userEvent.setup()
    render(<LinksTab task={task()} onAddLink={vi.fn()} onRemoveLink={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'links.add' }))
    expect(mockGet).not.toHaveBeenCalledWith('/candidates/undefined/references', expect.anything())
    expect(screen.queryByText('links.reference')).toBeNull()
  })

  it('renders an existing reference link with its own icon and removes it with the same body', async () => {
    mockGet.mockReset()
    mockGet.mockResolvedValue({ data: [] })
    const onRemoveLink = vi.fn()
    const withRef = task({ links: [
      { type: 'candidate', id: 'cand-1', label: 'Ahmed' },
      { type: 'reference', id: 'ref-1', label: 'Referentie A' },
    ] })
    const user = userEvent.setup()
    render(<LinksTab task={withRef} onAddLink={vi.fn()} onRemoveLink={onRemoveLink} />)
    expect(screen.getByText('Referentie A')).toBeInTheDocument()
    const rows = screen.getAllByRole('button', { name: 'links.remove' })
    await user.click(rows[rows.length - 1])
    expect(onRemoveLink).toHaveBeenCalledWith({ type: 'reference', id: 'ref-1' })
  })
})
