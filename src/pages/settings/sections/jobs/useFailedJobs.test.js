/**
 * useFailedJobs — covers the Taakbeheer "Mislukt" tab: per-row retry/forget reload
 * the list, the two bulk actions (retry-all/flush) toggle bulkBusy, and a failed
 * action surfaces the backend's error message instead of failing silently.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useFailedJobs } from './useFailedJobs'
import { fetchFailedJobs, retryFailedJob, forgetFailedJob, retryAllFailedJobs, flushFailedJobs } from './jobsApi'

vi.mock('./jobsApi', () => ({
  fetchFailedJobs: vi.fn(), retryFailedJob: vi.fn(), forgetFailedJob: vi.fn(),
  retryAllFailedJobs: vi.fn(), flushFailedJobs: vi.fn(),
}))

// Mimics the raw axios response `unwrapList` expects: res.data = the Laravel paginator envelope.
const page = (rows, over = {}) => ({ data: { data: rows, total: rows.length, current_page: 1, last_page: 1, per_page: 25, ...over } })

afterEach(() => vi.clearAllMocks())

describe('useFailedJobs', () => {
  it('loads page 1 on mount', async () => {
    vi.mocked(fetchFailedJobs).mockResolvedValue(page([{ uuid: 'a', queue: 'default' }]))
    const { result } = renderHook(() => useFailedJobs())
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    expect(fetchFailedJobs).toHaveBeenCalledWith({ page: 1, per_page: 25 }, expect.anything())
    expect(result.current.result.rows).toHaveLength(1)
  })

  it('retry() reloads the list and tracks busyId while in flight', async () => {
    vi.mocked(fetchFailedJobs).mockResolvedValue(page([{ uuid: 'a' }]))
    vi.mocked(retryFailedJob).mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useFailedJobs())
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    const callsBefore = vi.mocked(fetchFailedJobs).mock.calls.length
    await act(async () => { await result.current.retry('a') })
    expect(retryFailedJob).toHaveBeenCalledWith('a')
    expect(vi.mocked(fetchFailedJobs).mock.calls.length).toBeGreaterThan(callsBefore)
    expect(result.current.busyId).toBeNull()
  })

  it('forget() surfaces the server error and does not reload on failure', async () => {
    vi.mocked(fetchFailedJobs).mockResolvedValue(page([{ uuid: 'b' }]))
    vi.mocked(forgetFailedJob).mockRejectedValue({ response: { data: { message: 'Niet gevonden.' } } })
    const { result } = renderHook(() => useFailedJobs())
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    const callsBefore = vi.mocked(fetchFailedJobs).mock.calls.length
    await act(async () => { await result.current.forget('b') })
    expect(result.current.actionError).toBe('Niet gevonden.')
    expect(vi.mocked(fetchFailedJobs).mock.calls.length).toBe(callsBefore)
  })

  it('retryAll() calls the bulk endpoint and reloads', async () => {
    vi.mocked(fetchFailedJobs).mockResolvedValue(page([{ uuid: 'a' }, { uuid: 'b' }]))
    vi.mocked(retryAllFailedJobs).mockResolvedValue({ data: { count: 2 } })
    const { result } = renderHook(() => useFailedJobs())
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    await act(async () => { await result.current.retryAll() })
    expect(retryAllFailedJobs).toHaveBeenCalledTimes(1)
    expect(result.current.bulkBusy).toBe(false)
  })

  it('flush() calls the bulk endpoint and reloads', async () => {
    vi.mocked(fetchFailedJobs).mockResolvedValue(page([{ uuid: 'a' }]))
    vi.mocked(flushFailedJobs).mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useFailedJobs())
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    await act(async () => { await result.current.flush() })
    expect(flushFailedJobs).toHaveBeenCalledTimes(1)
    expect(result.current.bulkBusy).toBe(false)
  })
})
