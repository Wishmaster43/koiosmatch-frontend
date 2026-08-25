/**
 * useWaWebQueue — K-193 fase 1: the queue list carries the status filter as a
 * real query param, polls only while a row is queued/sending, the stats hook
 * hits its own route, and each action mutation asserts its exact route (§13).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useWaWebQueueList, useWaWebQueueStats, useWaWebQueueActions } from './useWaWebQueue'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

afterEach(() => vi.clearAllMocks())

describe('useWaWebQueueList', () => {
  it('requests GET /whatsapp-web/queue without a status param when unset', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    renderHook(() => useWaWebQueueList(undefined), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/whatsapp-web/queue', { params: undefined, signal: expect.anything() }))
  })

  it('forwards the status filter as a real query param', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    renderHook(() => useWaWebQueueList('failed'), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/whatsapp-web/queue', { params: { status: 'failed' }, signal: expect.anything() }))
  })
})

describe('useWaWebQueueStats', () => {
  it('requests GET /whatsapp-web/queue/stats', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    renderHook(() => useWaWebQueueStats(false), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/whatsapp-web/queue/stats', { signal: expect.anything() }))
  })
})

describe('useWaWebQueueActions', () => {
  it('send-now posts to the exact per-row route', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useWaWebQueueActions(), { wrapper })
    result.current.sendNow.mutate('row-1')
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/whatsapp-web/queue/row-1/send-now'))
  })

  it('pause posts to the exact per-row route', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useWaWebQueueActions(), { wrapper })
    result.current.pause.mutate('row-2')
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/whatsapp-web/queue/row-2/pause'))
  })

  it('retry posts to the exact per-row route', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useWaWebQueueActions(), { wrapper })
    result.current.retry.mutate('row-3')
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/whatsapp-web/queue/row-3/retry'))
  })

  it('cancel DELETEs the exact per-row route', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useWaWebQueueActions(), { wrapper })
    result.current.cancel.mutate('row-4')
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/whatsapp-web/queue/row-4'))
  })
})
