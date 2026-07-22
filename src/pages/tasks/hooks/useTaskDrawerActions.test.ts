/**
 * useTaskDrawerActions — regression test for the re-audit finding: selectTask's
 * detail GET used to swallow a failure silently (`.catch(() => {})`), leaving the
 * drawer stuck on the light row with empty detail sections and no signal to the
 * user. It must now notifyError (mirrors the handleUpdate/handleAddLink pattern
 * already in this file).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useTaskDrawerActions } from './useTaskDrawerActions'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import type { Task } from '@/types/task'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const mockedGet = vi.mocked(api.get)
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
