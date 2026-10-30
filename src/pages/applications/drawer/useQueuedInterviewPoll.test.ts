/** useQueuedInterviewPoll: backoff order, stop on landed, stop at the cap, silent after unmount. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useQueuedInterviewPoll, QUEUED_INTERVIEW_POLL_DELAYS_MS as D } from './useQueuedInterviewPoll'
import type { ApplicationInterview } from '@/types/application'

const IV = { id: 'iv-1' } as unknown as ApplicationInterview
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('useQueuedInterviewPoll', () => {
  it('reads after each delay and stops once the session landed', async () => {
    const fetchInterview = vi.fn().mockResolvedValueOnce(null).mockResolvedValue({ kind: 'landed', iv: IV })
    const onLanded = vi.fn()
    renderHook(() => useQueuedInterviewPoll({ applicationId: 'a', runId: 'r', fetchInterview, onLanded }))
    await act(async () => { await vi.advanceTimersByTimeAsync(D[0] - 1) })
    expect(fetchInterview).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(fetchInterview).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(D[1]) })
    expect(onLanded).toHaveBeenCalledWith(IV)
    await act(async () => { await vi.advanceTimersByTimeAsync(100000) })
    expect(fetchInterview).toHaveBeenCalledTimes(2)
    expect(onLanded).toHaveBeenCalledTimes(1)
  })

  it('stops polling when the queue skipped the start', async () => {
    const fetchInterview = vi.fn().mockResolvedValue({ kind: 'skipped' })
    const onSkipped = vi.fn()
    const onLanded = vi.fn()
    renderHook(() => useQueuedInterviewPoll({ applicationId: 'a', runId: 'r', fetchInterview, onLanded, onSkipped }))
    await act(async () => { await vi.advanceTimersByTimeAsync(100000) })
    expect(fetchInterview).toHaveBeenCalledTimes(1)
    expect(onSkipped).toHaveBeenCalledTimes(1)
    expect(onLanded).not.toHaveBeenCalled()
  })

  it('stops at the cap and reports capped', async () => {
    const fetchInterview = vi.fn().mockResolvedValue(null)
    const { result } = renderHook(() => useQueuedInterviewPoll({ applicationId: 'a', runId: 'r', fetchInterview, onLanded: vi.fn() }))
    await act(async () => { await vi.advanceTimersByTimeAsync(D.reduce((a, b) => a + b, 0) + 1000) })
    expect(fetchInterview).toHaveBeenCalledTimes(D.length)
    expect(result.current.capped).toBe(true)
  })

  it('makes no call after unmount, and none without a run id', async () => {
    const fetchInterview = vi.fn().mockResolvedValue(null)
    const { unmount } = renderHook(() => useQueuedInterviewPoll({ applicationId: 'a', runId: 'r', fetchInterview, onLanded: vi.fn() }))
    unmount()
    renderHook(() => useQueuedInterviewPoll({ applicationId: 'a', runId: null, fetchInterview, onLanded: vi.fn() }))
    await act(async () => { await vi.advanceTimersByTimeAsync(100000) })
    expect(fetchInterview).not.toHaveBeenCalled()
  })
})
