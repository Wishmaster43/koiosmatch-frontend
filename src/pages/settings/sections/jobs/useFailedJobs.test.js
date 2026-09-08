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

  it('retryAll() passes queue and tenant filters, and captures {count, skipped, truncated, scope}', async () => {
    vi.mocked(fetchFailedJobs).mockResolvedValue(page([{ uuid: 'a' }, { uuid: 'b' }]))
    vi.mocked(retryAllFailedJobs).mockResolvedValue({
      data: { count: 2, skipped: [], truncated: false, scope: { queue: 'sync', tenant: null } }
    })
    const { result } = renderHook(() => useFailedJobs())
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    await act(async () => { result.current.setFilter('queue', 'sync') })
    await waitFor(() => expect(result.current.filters.queue).toBe('sync'))
    let outcome
    await act(async () => { outcome = await result.current.retryAll() })
    expect(retryAllFailedJobs).toHaveBeenCalledWith('sync', undefined)
    expect(result.current.bulkBusy).toBe(false)
    expect(outcome).toEqual({ count: 2, skipped: [], truncated: false, scope: { queue: 'sync', tenant: null } })
  })

  it('retryAll() passes both queue and tenant filters when both are set (X-41)', async () => {
    vi.mocked(fetchFailedJobs).mockResolvedValue(page([{ uuid: 'a' }]))
    vi.mocked(retryAllFailedJobs).mockResolvedValue({
      data: { count: 1, skipped: [], truncated: false, scope: { queue: 'workflows', tenant: 'yesway' } }
    })
    const { result } = renderHook(() => useFailedJobs())
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    await act(async () => {
      result.current.setFilter('queue', 'workflows')
      result.current.setFilter('tenant', 'yesway')
    })
    await waitFor(() => expect(result.current.filters.queue).toBe('workflows'))
    let outcome
    await act(async () => { outcome = await result.current.retryAll() })
    expect(retryAllFailedJobs).toHaveBeenCalledWith('workflows', 'yesway')
    expect(outcome?.scope).toEqual({ queue: 'workflows', tenant: 'yesway' })
  })

  it('retryAll() calls with undefined queue and tenant when no filters are set', async () => {
    vi.mocked(fetchFailedJobs).mockResolvedValue(page([{ uuid: 'a' }]))
    vi.mocked(retryAllFailedJobs).mockResolvedValue({ data: { count: 1, skipped: [], truncated: false } })
    const { result } = renderHook(() => useFailedJobs())
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    await act(async () => { await result.current.retryAll() })
    expect(retryAllFailedJobs).toHaveBeenCalledWith(undefined, undefined)
    expect(result.current.bulkBusy).toBe(false)
  })

  it('flush() passes queue and tenant filters to the bulk endpoint (X-41)', async () => {
    vi.mocked(fetchFailedJobs).mockResolvedValue(page([{ uuid: 'a' }]))
    vi.mocked(flushFailedJobs).mockResolvedValue({
      data: { count: 1, skipped: [], truncated: false, scope: { queue: 'sync', tenant: null } }
    })
    const { result } = renderHook(() => useFailedJobs())
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    await act(async () => { result.current.setFilter('queue', 'sync') })
    await waitFor(() => expect(result.current.filters.queue).toBe('sync'))
    await act(async () => { await result.current.flush() })
    expect(flushFailedJobs).toHaveBeenCalledWith('sync', undefined)
    expect(result.current.bulkBusy).toBe(false)
  })

  it('flush() passes both queue and tenant filters when both are set', async () => {
    vi.mocked(fetchFailedJobs).mockResolvedValue(page([{ uuid: 'a' }]))
    vi.mocked(flushFailedJobs).mockResolvedValue({
      data: { count: 1, skipped: [], truncated: false, scope: { queue: 'workflows', tenant: 'yesway' } }
    })
    const { result } = renderHook(() => useFailedJobs())
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    await act(async () => {
      result.current.setFilter('queue', 'workflows')
      result.current.setFilter('tenant', 'yesway')
    })
    await waitFor(() => expect(result.current.filters.queue).toBe('workflows'))
    await act(async () => { await result.current.flush() })
    expect(flushFailedJobs).toHaveBeenCalledWith('workflows', 'yesway')
  })
})
