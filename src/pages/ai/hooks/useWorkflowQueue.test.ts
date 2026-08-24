/**
 * useWorkflowQueue — WF-WACHTRIJ-FE-1's data hook (K-171). Pins the GET route +
 * the ?workflow_id= filter, the four lists, and the calm 403 degrade (never a
 * red error banner for a permission gap).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useWorkflowQueue } from './useWorkflowQueue'
import api from '@/lib/api'

vi.mock('@/lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)

beforeEach(() => vi.clearAllMocks())

const FIXTURE = {
  pending: [{ run_id: 'r1', workflow_id: 'wf-1', workflow_name: 'Welcome', queued_at: '2026-08-24T08:00:00Z', trigger: 'event' }],
  waiting: [{ run_id: 'r2', workflow_id: 'wf-2', workflow_name: 'Reminder', queued_at: '2026-08-24T07:00:00Z', resume_at: '2026-08-25T08:00:00Z' }],
  scheduled: [{ workflow_id: 'wf-3', workflow_name: 'Daily sync', next_run_at: '2026-08-25T08:00:00Z', schedule_label: 'Dagelijks 08:00' }],
  retrying: [{ run_id: 'r4', workflow_id: 'wf-4', workflow_name: 'Match sync', attempts: 2, next_attempt_at: '2026-08-24T09:00:00Z', last_error: 'timeout' }],
  counts: { pending: 1, waiting: 1, scheduled_today: 1, retrying: 1 },
}

describe('useWorkflowQueue', () => {
  it('pins GET /workflows/queue (no filter) and exposes all four lists + counts', async () => {
    mockedGet.mockResolvedValue({ data: FIXTURE })
    const { result } = renderHook(() => useWorkflowQueue())
    expect(mockedGet).toHaveBeenCalledWith('/workflows/queue')
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.pending).toEqual(FIXTURE.pending)
    expect(result.current.waiting).toEqual(FIXTURE.waiting)
    expect(result.current.scheduled).toEqual(FIXTURE.scheduled)
    expect(result.current.retrying).toEqual(FIXTURE.retrying)
    expect(result.current.counts).toEqual(FIXTURE.counts)
    expect(result.current.error).toBe(false)
    expect(result.current.forbidden).toBe(false)
  })

  it('pins the ?workflow_id= filter param when one is passed', async () => {
    mockedGet.mockResolvedValue({ data: FIXTURE })
    renderHook(() => useWorkflowQueue('wf-1'))
    expect(mockedGet).toHaveBeenCalledWith('/workflows/queue?workflow_id=wf-1')
  })

  it('a real failure (non-403) is an honest error, not a silently-empty queue', async () => {
    mockedGet.mockRejectedValue({ response: { status: 500 } })
    const { result } = renderHook(() => useWorkflowQueue())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(true)
    expect(result.current.forbidden).toBe(false)
    expect(result.current.pending).toEqual([])
  })

  it('a 403 (no settings.view) degrades calmly — forbidden, never the red error state', async () => {
    mockedGet.mockRejectedValue({ response: { status: 403 } })
    const { result } = renderHook(() => useWorkflowQueue())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.forbidden).toBe(true)
    expect(result.current.error).toBe(false)
  })
})
