/**
 * useEntityTasks · the request IS the point (see the hook's own header comment):
 * before TASKS-LINK-FILTER-1 an ignored filter silently returned every task in
 * the tenant, so these tests assert the REQUEST (route/params), not only the
 * returned state. Also covers the calm-404 vs real-error split and that an id
 * switch aborts the stale request so a late response cannot win.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { AxiosRequestConfig } from 'axios'
import { useEntityTasks } from './useEntityTasks'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn() },
  // Minimal stand-in for the shared adapter: the hook only reads `.rows`.
  unwrapList: (res: { data?: { data?: unknown[] } }) => ({
    rows: res?.data?.data ?? [], total: 0, page: 1, lastPage: 1, perPage: 0,
  }),
}))

beforeEach(() => { vi.mocked(api.get).mockReset() })

describe('useEntityTasks · the request', () => {
  it('GETs /tasks with { [linkType]: id, per_page: 100 } for linkType "contact"', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    renderHook(() => useEntityTasks('contact', 'c-1'))
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(api.get).toHaveBeenCalledWith('/tasks', expect.objectContaining({
      params: { contact: 'c-1', per_page: 100 },
    }))
  })

  it('sends a different param key for a different linkType — proves the filter key is not hardcoded', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    renderHook(() => useEntityTasks('opportunity', 'op-9'))
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(api.get).toHaveBeenCalledWith('/tasks', expect.objectContaining({
      params: { opportunity: 'op-9', per_page: 100 },
    }))
  })

  it('makes no request and stays empty with no id', () => {
    const { result } = renderHook(() => useEntityTasks('contact', undefined))
    expect(api.get).not.toHaveBeenCalled()
    expect(result.current.items).toEqual([])
    expect(result.current.loading).toBe(false)
  })
})

describe('useEntityTasks · calm-404 vs real errors', () => {
  it('a 404 resolves calm: error stays false, items empty', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 404 } })
    const { result } = renderHook(() => useEntityTasks('contact', 'c-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(false)
    expect(result.current.items).toEqual([])
  })

  it('a 500 sets error true', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 500 } })
    const { result } = renderHook(() => useEntityTasks('contact', 'c-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(true)
    expect(result.current.items).toEqual([])
  })

  it('a network error with no `response` also sets error true — the real past bug', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Network Error'))
    const { result } = renderHook(() => useEntityTasks('contact', 'c-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(true)
    expect(result.current.items).toEqual([])
  })
})

describe('useEntityTasks · reload', () => {
  it('reload() refetches', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 1 }] } })
    const { result } = renderHook(() => useEntityTasks('contact', 'c-1'))
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(api.get).toHaveBeenCalledTimes(1)

    act(() => { result.current.reload() })
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
  })
})

describe('useEntityTasks · switching id aborts the stale request', () => {
  it('passes an AbortSignal, aborts it on id change, and a late response for the OLD id cannot win', async () => {
    // Deferred promises we resolve by hand, in whatever order we choose — this is
    // what lets the test prove the OLD id's response can arrive AFTER the switch
    // and still lose, instead of just trusting timing.
    const deferreds: Array<{ resolve: (v: unknown) => void; config: AxiosRequestConfig }> = []
    vi.mocked(api.get).mockImplementation((_url: string, config?: AxiosRequestConfig) =>
      new Promise(resolve => { deferreds.push({ resolve, config: config ?? {} }) }))

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useEntityTasks('contact', id),
      { initialProps: { id: 'a' } },
    )
    await waitFor(() => expect(deferreds).toHaveLength(1))
    expect(deferreds[0].config.signal).toBeInstanceOf(AbortSignal)
    expect(deferreds[0].config.signal?.aborted).toBe(false)

    // Switch id before the first request ever resolves.
    rerender({ id: 'b' })
    await waitFor(() => expect(deferreds).toHaveLength(2))
    expect(deferreds[0].config.signal?.aborted).toBe(true)
    expect(deferreds[1].config.signal?.aborted).toBe(false)
    expect(deferreds[1].config.params).toEqual({ contact: 'b', per_page: 100 })

    // The OLD id's response arrives LATE (after the switch) — resolving it must
    // NOT be allowed to overwrite state with stale data.
    deferreds[0].resolve({ data: { data: [{ id: 'stale-a' }] } })
    await Promise.resolve()
    await Promise.resolve()
    expect(result.current.items).toEqual([])

    // The NEW id's response arrives and wins.
    deferreds[1].resolve({ data: { data: [{ id: 'fresh-b' }] } })
    await waitFor(() => expect(result.current.items).toEqual([{ id: 'fresh-b' }]))
  })
})
