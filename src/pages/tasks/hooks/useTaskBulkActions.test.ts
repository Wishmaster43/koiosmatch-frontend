/**
 * useTaskBulkActions — BULK-WIRE-1: proves bulkSetStatus/bulkSetPriority PATCH the
 * resolved uuid under `status_id`/`priority_id` — the ONLY keys UpdateTaskRequest
 * validates — never the tenant slug under `status`/`priority` (measured: that key
 * is silently dropped by Laravel's validated(), 200 OK, nothing changes). §13:
 * assert the REQUEST BODY, not just that the callback fired.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { useTaskBulkActions } from './useTaskBulkActions'
import api from '@/lib/api'
import { notifySuccess } from '@/lib/notify'
import type { Task, TaskDetail } from '@/types/task'
import type { Id } from '@/types/common'
import type { Dispatch, SetStateAction } from 'react'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const mockedGet   = vi.mocked(api.get)
const mockedPatch = vi.mocked(api.patch)
const t = ((k: string) => k) as unknown as import('i18next').TFunction

afterEach(() => vi.clearAllMocks())

// Raw lookup rows (id = uuid FK, value = tenant slug) — what the bulk PATCH needs.
const seedLookupIds = () => mockedGet.mockImplementation((url: string) => {
  if (url === '/task-statuses')   return Promise.resolve({ data: [{ id: 'status-uuid-2', value: 'done', label: 'Done' }] })
  if (url === '/task-priorities') return Promise.resolve({ data: [{ id: 'prio-uuid-1', value: 'high', label: 'High' }] })
  return Promise.resolve({ data: [] })
})

// A real-timer tick, wrapped in act(): lets useTaskLookupIds' Promise.all().then()
// chain (and the resulting state update) fully settle before an action reads the
// resolved map — waiting only for the GET call itself is one microtask hop too early.
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 't1', title: 'Task', typeKey: 'call', typeLabel: '', typeColor: null,
  statusKey: 'todo', statusLabel: '', statusColor: null, statusIsDone: false,
  priorityKey: 'normal', priorityLabel: '', priorityColor: null,
  assigneeId: null, assignee: null, owner: { name: '' }, due: '', dueTime: '', completedAt: '',
  tags: [], links: [], linkLabel: '', commentCount: 0, createdAt: '', archived: false, archivedAt: null,
  ...overrides,
} as Task)

// Harness with real state so selection + the optimistic local patch are observable.
function harness(initialTasks: Task[], initialSelectedIds: Set<Id>) {
  return renderHook(() => {
    const [tasks, setTasks] = useState<Task[]>(initialTasks)
    const [selectedIds, setSelectedIds] = useState<Set<Id>>(initialSelectedIds)
    const [selected, setSelected] = useState<TaskDetail | null>(null)
    const actions = useTaskBulkActions({
      setTasks: setTasks as Dispatch<SetStateAction<Task[]>>, setSelected, selected,
      closeDrawer: vi.fn(), selectedIds, setSelectedIds, decorate: x => x, users: [], t,
    })
    return { tasks, selectedIds, actions }
  })
}

describe('useTaskBulkActions · bulkSetStatus', () => {
  it('PATCHes { status_id: <uuid> }, resolved from the slug — never { status: <slug> }', async () => {
    seedLookupIds()
    mockedPatch.mockResolvedValue({})
    const r = harness([task({ id: 't1' }), task({ id: 't2' })], new Set(['t1', 't2']))
    await flush()

    await act(async () => { await r.result.current.actions.bulkSetStatus('done') })

    expect(mockedPatch).toHaveBeenCalledWith('/tasks/t1', { status_id: 'status-uuid-2' })
    expect(mockedPatch).toHaveBeenCalledWith('/tasks/t2', { status_id: 'status-uuid-2' })
    await waitFor(() => expect(notifySuccess).toHaveBeenCalled())
  })

  it('keeps the LOCAL optimistic statusKey as the slug (row display stays correct)', async () => {
    seedLookupIds()
    mockedPatch.mockResolvedValue({})
    const r = harness([task({ id: 't1', statusKey: 'todo' })], new Set(['t1']))
    await flush()

    act(() => { r.result.current.actions.bulkSetStatus('done') })

    expect(r.result.current.tasks[0].statusKey).toBe('done')
  })
})

describe('useTaskBulkActions · bulkSetPriority', () => {
  it('PATCHes { priority_id: <uuid> }, resolved from the slug', async () => {
    seedLookupIds()
    mockedPatch.mockResolvedValue({})
    const r = harness([task({ id: 't1' })], new Set(['t1']))
    await flush()

    await act(async () => { await r.result.current.actions.bulkSetPriority('high') })

    expect(mockedPatch).toHaveBeenCalledWith('/tasks/t1', { priority_id: 'prio-uuid-1' })
  })
})
