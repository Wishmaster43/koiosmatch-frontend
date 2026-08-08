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
 *
 * TASKTYPE-ID-1 (measured bug, fixed here): handleUpdate used to PATCH the bare
 * tenant slug under `status`/`priority`/`type` — keys UpdateTaskRequest never
 * declares as validated rules, so Laravel's `validated()` silently drops them
 * (200 OK, nothing changes). It now resolves each axis to its real uuid FK via the
 * shared `useTaskLookupIds` hook (see its header comment) and sends
 * `status_id`/`priority_id`/`type_id`. When an axis can't be resolved (lookups
 * still loading, or a seed-only fallback slug with no server row) the WHOLE
 * update is aborted — no request, no optimistic write, an honest toast — never a
 * request that will silently no-op.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

// The three raw lookup endpoints useTaskLookupIds resolves slugs against (id =
// uuid FK, value = tenant slug). Empty by default — a test that doesn't care
// about axis resolution never has to think about it; `seedAllLookups` below
// fills them in for tests that PATCH a status/priority/type key.
const LOOKUP_URLS = ['/task-types', '/task-statuses', '/task-priorities']
let lookupRows: Record<string, Array<{ id: string; value: string }>> = {}
// Everything else (the `/tasks/{id}` detail fetch) routes through this per-test stub.
let taskGetImpl: (url: string) => Promise<unknown> = () => Promise.resolve({ data: {} })

// Route every api.get by URL: the three lookup endpoints resolve from `lookupRows`,
// anything else (the detail fetch) delegates to the test's own `taskGetImpl` — so a
// test that rejects/hangs the detail fetch never accidentally starves the lookup
// maps (and vice versa), keeping the two concerns independently controllable.
beforeEach(() => {
  lookupRows = { '/task-types': [], '/task-statuses': [], '/task-priorities': [] }
  taskGetImpl = () => Promise.resolve({ data: {} })
  mockedGet.mockImplementation((url: string) => (
    LOOKUP_URLS.includes(url) ? Promise.resolve({ data: lookupRows[url] }) : taskGetImpl(url)
  ))
})
afterEach(() => vi.clearAllMocks())

// Seeds a real uuid for every axis slug the fixtures below use.
const seedAllLookups = () => {
  lookupRows = {
    '/task-types':      [{ id: 'type-uuid-call', value: 'call' }],
    '/task-statuses':   [{ id: 'status-uuid-todo', value: 'todo' }, { id: 'status-uuid-done', value: 'done' }],
    '/task-priorities': [{ id: 'prio-uuid-normal', value: 'normal' }, { id: 'prio-uuid-high', value: 'high' }],
  }
}

// A real-timer tick, wrapped in act(): lets useTaskLookupIds' Promise.all().then()
// chain (and the resulting state update) fully settle before a test dispatches an
// update — waiting only for the GET calls themselves is one microtask hop too early
// (mirrors useTaskBulkActions.test.ts / TasksBoard.test.tsx's identical idiom).
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })

// A light row as it arrives from the table/board before the detail fetch resolves.
const lightRow = { id: 't1', title: 'Task 1' } as unknown as Task

describe('useTaskDrawerActions · selectTask error signalling', () => {
  it('notifies the user when the detail fetch fails', async () => {
    taskGetImpl = () => Promise.reject({ response: { status: 500 } })
    const { result } = renderHook(() => useTaskDrawerActions({
      setTasks: vi.fn(), archivedTasks: [], setArchivedTasks: vi.fn(), decorate: x => x, t,
    }))

    act(() => { result.current.selectTask(lightRow) })

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('common:actionFailed'))
    // The light row still shows (no silent blank drawer) while the notice fires.
    expect(result.current.selected?.id).toBe('t1')
  })

  it('does not notify once a different task has since been opened', async () => {
    // Each api.get call for a `/tasks/{id}` detail fetch gets its own reject
    // callback, indexed by call order (the lookup endpoints never touch this).
    const rejectors: Array<(err: unknown) => void> = []
    taskGetImpl = () => new Promise((_, rej) => { rejectors.push(rej) })
    const { result } = renderHook(() => useTaskDrawerActions({
      setTasks: vi.fn(), archivedTasks: [], setArchivedTasks: vi.fn(), decorate: x => x, t,
    }))

    act(() => { result.current.selectTask(lightRow) })
    // The user moves on to a second task before the first (now-stale) fetch settles.
    act(() => { result.current.selectTask({ id: 't2', title: 'Task 2' } as unknown as Task) })
    // The STALE t1 fetch finally comes back as an error — must not notify, since
    // t2 is the current selection by the time it resolves.
    act(() => { rejectors[0]({ response: { status: 500 } }) })

    // act()-wrapped: also lets useTaskLookupIds' own Promise.all().then() chain
    // settle without an "update not wrapped in act" warning.
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })
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
  it('PATCHes the resolved uuid body and keeps the new value when the server accepts', async () => {
    seedAllLookups()
    mockedPatch.mockResolvedValue({})
    const r = harness([task({ id: 't1', statusKey: 'todo' })])
    await flush()
    act(() => { r.result.current.actions.handleUpdate('t1', { statusKey: 'done' }) })
    expect(mockedPatch).toHaveBeenCalledWith('/tasks/t1', { status_id: 'status-uuid-done' })
    await waitFor(() => expect(r.result.current.tasks[0].statusKey).toBe('done'))
    expect(notifyError).not.toHaveBeenCalled()
  })

  // T1 (task drawer title pencil): title was missing entirely from the body
  // mapping — a title edit had nowhere to go. Regression: assert the REQUEST (§13).
  // `title` is not a lookup axis, so this never touches the resolution path.
  it('PATCHes { title } when the drawer title pencil saves', async () => {
    mockedPatch.mockResolvedValue({})
    const r = harness([task({ id: 't1', title: 'Old title' })])
    act(() => { r.result.current.actions.handleUpdate('t1', { title: 'New title' }) })
    expect(mockedPatch).toHaveBeenCalledWith('/tasks/t1', { title: 'New title' })
    await waitFor(() => expect(r.result.current.tasks[0].title).toBe('New title'))
  })

  // TASK-LOCATION-READ-1: branch (vestiging) is a direct FK patch, never a lookup
  // axis, so it PATCHes straight through with no uuid resolution required.
  it('PATCHes { location_id } when a branch is picked', async () => {
    mockedPatch.mockResolvedValue({})
    const r = harness([task({ id: 't1', location: null })])
    act(() => { r.result.current.actions.handleUpdate('t1', { locationId: 'loc-1', location: { id: 'loc-1', name: 'Vestiging Noord' } }) })
    expect(mockedPatch).toHaveBeenCalledWith('/tasks/t1', { location_id: 'loc-1' })
    await waitFor(() => expect(r.result.current.tasks[0].location).toEqual({ id: 'loc-1', name: 'Vestiging Noord' }))
  })

  // Clearable: an explicit null must reach the server, never be dropped like an
  // untouched/undefined key (see the `delete body[k] === undefined` sweep above).
  it('PATCHes { location_id: null } when the branch is cleared', async () => {
    mockedPatch.mockResolvedValue({})
    const r = harness([task({ id: 't1', location: { id: 'loc-1', name: 'Vestiging Noord' } })])
    act(() => { r.result.current.actions.handleUpdate('t1', { locationId: null, location: null }) })
    expect(mockedPatch).toHaveBeenCalledWith('/tasks/t1', { location_id: null })
    await waitFor(() => expect(r.result.current.tasks[0].location).toBeNull())
  })

  it('reverts ONLY the patched field and reports the server message when the PATCH fails', async () => {
    seedAllLookups()
    mockedPatch.mockRejectedValue({ response: { status: 422, data: { message: 'Status bestaat niet meer' } } })
    const r = harness([task({ id: 't1', statusKey: 'todo', title: 'Keep me' })])
    await flush()
    act(() => { r.result.current.actions.handleUpdate('t1', { statusKey: 'done' }) })
    expect(r.result.current.tasks[0].statusKey).toBe('done') // optimistic
    await waitFor(() => expect(r.result.current.tasks[0].statusKey).toBe('todo')) // reverted
    expect(r.result.current.tasks[0].title).toBe('Keep me') // untouched field survives
    expect(notifyError).toHaveBeenCalledWith('Status bestaat niet meer')
  })

  it('does not clobber a parallel edit to another field made while the first PATCH is in flight', async () => {
    seedAllLookups()
    // Each PATCH call gets its own reject callback, indexed by call order.
    const rejectors: Array<(err: unknown) => void> = []
    mockedPatch.mockImplementation(() => new Promise((_, rej) => { rejectors.push(rej) }))
    const r = harness([task({ id: 't1', statusKey: 'todo', title: 'Original' })])
    await flush()
    act(() => { r.result.current.actions.handleUpdate('t1', { statusKey: 'done' }) })
    act(() => { r.result.current.actions.handleUpdate('t1', { title: 'Edited meanwhile' }) })
    // Only the FIRST (status) request fails; the second (title) never settles.
    act(() => { rejectors[0]({ response: { status: 500 } }) })
    await waitFor(() => expect(r.result.current.tasks[0].statusKey).toBe('todo'))
    // The revert must restore statusKey only — the parallel title edit must survive.
    expect(r.result.current.tasks[0].title).toBe('Edited meanwhile')
  })
})

// TASKTYPE-ID-1: one regression test per axis proving the PATCH body carries the
// resolved uuid FK, never the bare tenant slug — plus the "can't resolve yet" guard.
describe('useTaskDrawerActions · handleUpdate — TASKTYPE-ID-1 axis resolution', () => {
  it('status axis: PATCHes { status_id: <uuid> }, never { status: <slug> }', async () => {
    seedAllLookups()
    mockedPatch.mockResolvedValue({})
    const r = harness([task({ id: 't1', statusKey: 'todo' })])
    await flush()
    act(() => { r.result.current.actions.handleUpdate('t1', { statusKey: 'done' }) })
    const body = mockedPatch.mock.calls[0][1] as Record<string, unknown>
    expect(body).toEqual({ status_id: 'status-uuid-done' })
    expect(body).not.toHaveProperty('status')
  })

  it('priority axis: PATCHes { priority_id: <uuid> }, never { priority: <slug> }', async () => {
    seedAllLookups()
    mockedPatch.mockResolvedValue({})
    const r = harness([task({ id: 't1', priorityKey: 'normal' })])
    await flush()
    act(() => { r.result.current.actions.handleUpdate('t1', { priorityKey: 'high' }) })
    const body = mockedPatch.mock.calls[0][1] as Record<string, unknown>
    expect(body).toEqual({ priority_id: 'prio-uuid-high' })
    expect(body).not.toHaveProperty('priority')
  })

  it('type axis: PATCHes { type_id: <uuid> }, never { type: <slug> }', async () => {
    seedAllLookups()
    mockedPatch.mockResolvedValue({})
    const r = harness([task({ id: 't1', typeKey: 'call' })])
    await flush()
    act(() => { r.result.current.actions.handleUpdate('t1', { typeKey: 'call' }) })
    const body = mockedPatch.mock.calls[0][1] as Record<string, unknown>
    expect(body).toEqual({ type_id: 'type-uuid-call' })
    expect(body).not.toHaveProperty('type')
  })

  it('aborts the whole update and leaves the picker unchanged when the slug has no matching row', async () => {
    // lookupRows stays empty (beforeEach default) — 'done' never resolves.
    const r = harness([task({ id: 't1', statusKey: 'todo' })])
    await flush()
    act(() => { r.result.current.actions.handleUpdate('t1', { statusKey: 'done' }) })
    expect(mockedPatch).not.toHaveBeenCalled()
    expect(r.result.current.tasks[0].statusKey).toBe('todo') // untouched — no optimistic write either
    expect(notifyError).toHaveBeenCalledWith('drawer.lookupNotReady')
  })

  it('aborts while the lookup maps are still loading, never firing a request that would silently no-op', () => {
    // The lookup GETs never resolve within this test — the maps stay {} throughout.
    mockedGet.mockImplementation((url: string) => (LOOKUP_URLS.includes(url) ? new Promise(() => {}) : taskGetImpl(url)))
    const r = harness([task({ id: 't1', statusKey: 'todo' })])
    act(() => { r.result.current.actions.handleUpdate('t1', { statusKey: 'done' }) })
    expect(mockedPatch).not.toHaveBeenCalled()
    expect(r.result.current.tasks[0].statusKey).toBe('todo')
    expect(notifyError).toHaveBeenCalledWith('drawer.lookupNotReady')
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
