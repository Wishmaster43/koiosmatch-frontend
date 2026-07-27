/**
 * useTaskDrawerActions — regression coverage for the optimistic-update bug class
 * (measured audit 2026-07-27): an optimistic write into local state that is never
 * reverted when the request fails, so the screen keeps showing a value the server
 * rejected. Covers: selectTask's detail GET (was a fully silent `.catch(() => {})`),
 * handleUpdate's field patch (was `.catch(() => notifyError(...))` with no revert),
 * and the two link mutations handleAddLink/handleRemoveLink (same shape). Every
 * revert test asserts the SEAM (§13): the exact request, the optimistic write, and
 * that a rejection restores ONLY the touched field(s) — never the whole row — while
 * surfacing the server's own message via extractApiError.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { useTaskDrawerActions } from './useTaskDrawerActions'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import type { Task, TaskDetail } from '@/types/task'
import type { Dispatch, SetStateAction } from 'react'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const mockedGet    = vi.mocked(api.get)
const mockedPatch  = vi.mocked(api.patch)
const mockedPost   = vi.mocked(api.post)
const mockedDelete = vi.mocked(api.delete)
const t = ((k: string) => k) as unknown as import('i18next').TFunction

afterEach(() => vi.clearAllMocks())

// A light row as it arrives from the table/board before the detail fetch resolves.
const lightRow = { id: 't1', title: 'Task 1' } as unknown as Task

describe('useTaskDrawerActions · selectTask error signalling', () => {
  it('notifies the user when the detail fetch fails', async () => {
    mockedGet.mockRejectedValue({ response: { status: 500 } })
    const { result } = renderHook(() => useTaskDrawerActions({
      setTasks: vi.fn(), archivedTasks: [], setArchivedTasks: vi.fn(), decorate: x => x, t,
    }))

    act(() => { result.current.selectTask(lightRow) })

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('common:actionFailed'))
    // The light row still shows (no silent blank drawer) while the notice fires.
    expect(result.current.selected?.id).toBe('t1')
  })

  it('does not notify once a different task has since been opened', async () => {
    // Each api.get call gets its own reject callback, indexed by call order.
    const rejectors: Array<(err: unknown) => void> = []
    mockedGet.mockImplementation(() => new Promise((_, rej) => { rejectors.push(rej) }))
    const { result } = renderHook(() => useTaskDrawerActions({
      setTasks: vi.fn(), archivedTasks: [], setArchivedTasks: vi.fn(), decorate: x => x, t,
    }))

    act(() => { result.current.selectTask(lightRow) })
    // The user moves on to a second task before the first (now-stale) fetch settles.
    act(() => { result.current.selectTask({ id: 't2', title: 'Task 2' } as unknown as Task) })
    // The STALE t1 fetch finally comes back as an error — must not notify, since
    // t2 is the current selection by the time it resolves.
    act(() => { rejectors[0]({ response: { status: 500 } }) })

    await new Promise(r => setTimeout(r, 0))
    expect(notifyError).not.toHaveBeenCalled()
  })
})

// Minimal Task fixture — only the fields the mutations under test read/write.
const task = (overrides: Partial<Task> = {}): Task => ({
  id: 't1', title: 'Task', typeKey: 'call', typeLabel: '', typeColor: null,
  statusKey: 'todo', statusLabel: '', statusColor: null, statusIsDone: false,
  priorityKey: 'normal', priorityLabel: '', priorityColor: null,
  assigneeId: null, assignee: null, owner: { name: '' }, due: '', dueTime: '', completedAt: '',
  tags: [], links: [], linkLabel: '', commentCount: 0, createdAt: '', archived: false, archivedAt: null,
  ...overrides,
} as Task)

const taskDetail = (overrides: Partial<TaskDetail> = {}): TaskDetail => ({
  ...task(overrides), description: '', comments: [], activity: [], customFields: {},
  ...overrides,
} as TaskDetail)

// Harness with real state so the optimistic write → revert-on-failure is observable
// (mirrors useApplicationDrawerActions.test.ts's harness).
function harness(initialTasks: Task[]) {
  return renderHook(() => {
    const [tasks, setTasks] = useState<Task[]>(initialTasks)
    const [archivedTasks, setArchivedTasks] = useState<Task[]>([])
    const actions = useTaskDrawerActions({
      setTasks: setTasks as Dispatch<SetStateAction<Task[]>>, archivedTasks, setArchivedTasks, decorate: x => x, t,
    })
    return { tasks, actions }
  })
}

describe('useTaskDrawerActions · handleUpdate', () => {
  it('PATCHes the mapped body and keeps the new value when the server accepts', async () => {
    mockedPatch.mockResolvedValue({})
    const r = harness([task({ id: 't1', statusKey: 'todo' })])
    act(() => { r.result.current.actions.handleUpdate('t1', { statusKey: 'done' }) })
    expect(mockedPatch).toHaveBeenCalledWith('/tasks/t1', { status: 'done' })
    await waitFor(() => expect(r.result.current.tasks[0].statusKey).toBe('done'))
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('reverts ONLY the patched field and reports the server message when the PATCH fails', async () => {
    mockedPatch.mockRejectedValue({ response: { status: 422, data: { message: 'Status bestaat niet meer' } } })
    const r = harness([task({ id: 't1', statusKey: 'todo', title: 'Keep me' })])
    act(() => { r.result.current.actions.handleUpdate('t1', { statusKey: 'done' }) })
    expect(r.result.current.tasks[0].statusKey).toBe('done') // optimistic
    await waitFor(() => expect(r.result.current.tasks[0].statusKey).toBe('todo')) // reverted
    expect(r.result.current.tasks[0].title).toBe('Keep me') // untouched field survives
    expect(notifyError).toHaveBeenCalledWith('Status bestaat niet meer')
  })

  it('does not clobber a parallel edit to another field made while the first PATCH is in flight', async () => {
    // Each PATCH call gets its own reject callback, indexed by call order.
    const rejectors: Array<(err: unknown) => void> = []
    mockedPatch.mockImplementation(() => new Promise((_, rej) => { rejectors.push(rej) }))
    const r = harness([task({ id: 't1', statusKey: 'todo', title: 'Original' })])
    act(() => { r.result.current.actions.handleUpdate('t1', { statusKey: 'done' }) })
    act(() => { r.result.current.actions.handleUpdate('t1', { title: 'Edited meanwhile' }) })
    // Only the FIRST (status) request fails; the second (title) never settles.
    act(() => { rejectors[0]({ response: { status: 500 } }) })
    await waitFor(() => expect(r.result.current.tasks[0].statusKey).toBe('todo'))
    // The revert must restore statusKey only — the parallel title edit must survive.
    expect(r.result.current.tasks[0].title).toBe('Edited meanwhile')
  })
})

describe('useTaskDrawerActions · handleAddLink', () => {
  it('POSTs the link and applies the authoritative detail on success', async () => {
    mockedPost.mockResolvedValue({ data: { id: 't1', links: [{ type: 'candidate', id: 'c1', label: 'Jane' }] } })
    const r = harness([task({ id: 't1' })])
    act(() => { r.result.current.actions.setSelected(taskDetail({ id: 't1', links: [] })) })
    act(() => { r.result.current.actions.handleAddLink('t1', { type: 'candidate', id: 'c1', label: 'Jane' }) })
    expect(mockedPost).toHaveBeenCalledWith('/tasks/t1/links', { type: 'candidate', id: 'c1' })
    expect(r.result.current.actions.selected?.links).toHaveLength(1) // optimistic
    await waitFor(() => expect(r.result.current.actions.selected?.links[0].label).toBe('Jane'))
  })

  it('reverts the added link and reports the server message when the POST fails', async () => {
    mockedPost.mockRejectedValue({ response: { status: 422, data: { message: 'Kandidaat bestaat niet meer' } } })
    const r = harness([task({ id: 't1' })])
    act(() => { r.result.current.actions.setSelected(taskDetail({ id: 't1', links: [] })) })
    act(() => { r.result.current.actions.handleAddLink('t1', { type: 'candidate', id: 'c1', label: 'Jane' }) })
    expect(r.result.current.actions.selected?.links).toHaveLength(1) // optimistic
    await waitFor(() => expect(r.result.current.actions.selected?.links).toHaveLength(0)) // reverted
    expect(notifyError).toHaveBeenCalledWith('Kandidaat bestaat niet meer')
  })
})

describe('useTaskDrawerActions · handleRemoveLink', () => {
  it('DELETEs the link and applies the authoritative detail on success', async () => {
    mockedDelete.mockResolvedValue({ data: { id: 't1', links: [] } })
    const r = harness([task({ id: 't1' })])
    act(() => { r.result.current.actions.setSelected(taskDetail({ id: 't1', links: [{ type: 'candidate', id: 'c1', label: 'Jane' }] })) })
    act(() => { r.result.current.actions.handleRemoveLink('t1', { type: 'candidate', id: 'c1' }) })
    expect(mockedDelete).toHaveBeenCalledWith('/tasks/t1/links', { data: { type: 'candidate', id: 'c1' } })
    expect(r.result.current.actions.selected?.links).toHaveLength(0) // optimistic
    await waitFor(() => expect(notifyError).not.toHaveBeenCalled())
  })

  it('reverts the removed link and reports failure when the DELETE fails', async () => {
    mockedDelete.mockRejectedValue({ response: { status: 500 } })
    const r = harness([task({ id: 't1' })])
    act(() => { r.result.current.actions.setSelected(taskDetail({ id: 't1', links: [{ type: 'candidate', id: 'c1', label: 'Jane' }] })) })
    act(() => { r.result.current.actions.handleRemoveLink('t1', { type: 'candidate', id: 'c1' }) })
    expect(r.result.current.actions.selected?.links).toHaveLength(0) // optimistic
    await waitFor(() => expect(r.result.current.actions.selected?.links).toHaveLength(1)) // reverted
    expect(notifyError).toHaveBeenCalledWith('common:actionFailed')
  })
})
