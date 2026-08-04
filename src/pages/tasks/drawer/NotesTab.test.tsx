import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotesTab from './NotesTab'
import type { TaskDetail } from '@/types/task'

// Keep the real unwrap/unwrapList (importActual) — only the default client is
// stubbed. Unlike vacancies' NotesTab (notes arrive via a preloaded prop), this
// tab fetches its own list (GET /tasks/{id}/notes), so unwrapList must be real.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: [] })), post: vi.fn() } }
})
// Stub useDateFormat so the shared NotesTab doesn't transitively init i18n (t() → keys).
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, locale: 'nl-NL' }) }))
// OPTIMISTIC-REVERT-1 pattern (mirrors matches/vacancies/applications NotesTab.test.tsx):
// mock notify so a failed save's error toast is assertable.
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))

import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

const task = (over: Partial<TaskDetail> = {}) => ({
  id: 't1', owner: { name: 'Bente de Jong' }, ...over,
} as unknown as TaskDetail)

describe('task NotesTab (NT-TASK-1, shared reuse)', () => {
  it('fetches this task\'s notes and shows the empty state', async () => {
    render(<NotesTab task={task()} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/tasks/t1/notes'))
    expect(await screen.findByText('notes.title')).toBeInTheDocument()
    expect(await screen.findByText('notes.empty')).toBeInTheDocument()
  })

  it('offers a new-note composer button once loaded', async () => {
    render(<NotesTab task={task()} />)
    expect(await screen.findByRole('button', { name: 'notes.new' })).toBeInTheDocument()
  })

  it('does not render the drawer-owned timeline/conversations sections here', async () => {
    render(<NotesTab task={task()} />)
    await screen.findByText('notes.empty')
    expect(screen.queryByText('sections.timeline')).toBeNull()
    expect(screen.queryByText('sections.conversations')).toBeNull()
  })

  // §13 — a mutation test must assert the REQUEST, not only that a callback fired.
  // TaskCommentController validates `type` against the entity=task note_types scope
  // (NT-TASK-1), so the composer must actually carry the picked type on save.
  it('POSTs the picked note type to /tasks/{id}/notes', async () => {
    mockPost.mockResolvedValue({ data: { id: 99, body: 'x', type: 'intake', created_at: '2026-08-04' } })
    const user = userEvent.setup()
    render(<NotesTab task={task()} />)
    await user.click(await screen.findByRole('button', { name: 'notes.new' }))
    // Seed fallback (DEFAULT_NOTE_TYPES) renders while /note-types resolves empty —
    // pick a non-default type pill to prove the choice, not just the default, rides along.
    await user.click(screen.getByRole('button', { name: 'Intake' }))
    await user.click(screen.getByRole('button', { name: 'notes.save' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/tasks/t1/notes', expect.objectContaining({ type: 'intake' })))
  })

  it('removes the optimistic note and reports the server message when the save FAILS', async () => {
    mockPost.mockRejectedValue({ response: { status: 422, data: { message: 'Notitie opslaan mislukt' } } })
    const user = userEvent.setup()
    render(<NotesTab task={task()} />)
    await user.click(await screen.findByRole('button', { name: 'notes.new' }))
    await user.click(screen.getByRole('button', { name: 'notes.save' }))
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect(screen.getByText('notes.empty')).toBeInTheDocument()
    expect(notifyError).toHaveBeenCalledWith('Notitie opslaan mislukt')
  })

  // Load-error retry (Danny 04-08, mirrors the match tab): a failed GET renders the
  // shared tab's danger row + retry button; clicking it must fire a SECOND request
  // (§13 — assert the REQUEST, never only that a callback fired).
  it('retries the GET when the load-error retry button is clicked', async () => {
    // Reset the call ledger first — earlier tests in this file already mounted a
    // task with the same id, so their /tasks/t1/notes calls would otherwise inflate
    // the counts below. `api.get` is ALSO shared with useNoteTypes' own
    // `/note-types?entity=task` lookup, so filter on the notes route specifically.
    mockGet.mockClear()
    const notesCalls = () => mockGet.mock.calls.filter(c => c[0] === '/tasks/t1/notes').length
    mockGet.mockImplementation((url: string) =>
      url === '/tasks/t1/notes' && notesCalls() === 1
        ? Promise.reject({ response: { status: 500 } })
        : Promise.resolve({ data: [] }))
    const user = userEvent.setup()
    render(<NotesTab task={task()} />)
    await waitFor(() => expect(notesCalls()).toBe(1))
    expect(await screen.findByText('notes.loadError')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'common:error.retry' }))
    await waitFor(() => expect(notesCalls()).toBe(2))
    expect(mockGet).toHaveBeenCalledWith('/tasks/t1/notes')
    expect(await screen.findByText('notes.empty')).toBeInTheDocument()
  })
})
