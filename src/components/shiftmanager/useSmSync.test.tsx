/**
 * useSmSync — GEO-POLL-1 regression: a queued sync (202) must not rely on ONE
 * fixed-delay refetch. It re-checks the sync-sources query on a backoff schedule
 * until the cached snapshot actually changes (the job landed), and stops polling
 * once it does — never an unbounded interval, never a single-shot timer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useSmSync } from './useSmSync'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({ default: { post: vi.fn() } }))
const mockedPost = vi.mocked(api.post)

const SYNC_KEY = ['dashboard', 'sync-sources']

// Fresh QueryClient per test — no cross-test cache bleed.
function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

describe('useSmSync · backoff poll', () => {
  it('keeps re-checking sync-sources on a backoff schedule while the snapshot is unchanged', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(SYNC_KEY, [{ system: 'shiftmanager', last_synced_at: 'before' }])
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    mockedPost.mockResolvedValue({ data: { queued: [], last_synced_at: 'before' } })

    const { result } = renderHook(() => useSmSync(), { wrapper: makeWrapper(client) })
    await act(async () => { await result.current.sync('c1') })
    // The immediate post-queue invalidation.
    expect(invalidateSpy).toHaveBeenCalledTimes(1)

    // First backoff step (5s): snapshot still unchanged, so it schedules another check.
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(invalidateSpy).toHaveBeenCalledTimes(2)

    // Second backoff step (5s): still unchanged.
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(invalidateSpy).toHaveBeenCalledTimes(3)
  })

  it('stops polling once the sync-sources snapshot actually changes', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(SYNC_KEY, [{ system: 'shiftmanager', last_synced_at: 'before' }])
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    mockedPost.mockResolvedValue({ data: { queued: [], last_synced_at: 'before' } })

    const { result } = renderHook(() => useSmSync(), { wrapper: makeWrapper(client) })
    await act(async () => { await result.current.sync('c1') })
    expect(invalidateSpy).toHaveBeenCalledTimes(1)

    // The job lands: the cache now carries a fresher last_synced_at.
    client.setQueryData(SYNC_KEY, [{ system: 'shiftmanager', last_synced_at: 'after' }])

    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(invalidateSpy).toHaveBeenCalledTimes(2) // the landing check itself

    // No further checks scheduled once landed.
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(invalidateSpy).toHaveBeenCalledTimes(2)
  })

  it('cancels the in-flight poll when a new sync starts', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(SYNC_KEY, [{ system: 'shiftmanager', last_synced_at: 'before' }])
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    mockedPost.mockResolvedValue({ data: { queued: [], last_synced_at: 'before' } })

    const { result } = renderHook(() => useSmSync(), { wrapper: makeWrapper(client) })
    await act(async () => { await result.current.sync('c1') })
    await act(async () => { await result.current.sync('c1') }) // fires again before the old poll would land
    const countAfterSecondSync = invalidateSpy.mock.calls.length

    // The stale generation's would-be tick must never fire on top of the fresh one.
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(invalidateSpy).toHaveBeenCalledTimes(countAfterSecondSync + 1)
  })

  it('surfaces a throttled (429) result without starting a poll', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    mockedPost.mockRejectedValue({ response: { status: 429, data: { retry_after: 30 } } })

    const { result } = renderHook(() => useSmSync(), { wrapper: makeWrapper(client) })
    await act(async () => { await result.current.sync('c1') })
    expect(result.current.result).toEqual({ kind: 'throttled', retryAfter: 30 })
    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})
