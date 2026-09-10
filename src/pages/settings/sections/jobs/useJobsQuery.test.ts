/**
 * useJobsQuery — test that the hook builds params, loads with AbortController,
 * calls fetchFn with correct params/signal, and resets page on filter change.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useJobsQuery } from './useJobsQuery'

describe('useJobsQuery', () => {
  it('calls fetchFn with params built from filters and page', async () => {
    // Mock data structure: unwrapList expects { rows, total, page, last_page }.
    const mockResponse = { data: { rows: [{ id: 1 }], total: 1, page: 1, last_page: 1 } }
    const fetchFn = vi.fn().mockResolvedValue(mockResponse)
    const buildParams = vi.fn().mockReturnValue({ page: 1, per_page: 25, queue: 'test' })

    const { result } = renderHook(() =>
      useJobsQuery({
        fetchFn,
        buildParams,
        initialFilters: { queue: 'test' },
      })
    )

    // Initial state: loading.
    expect(result.current.phase).toBe('loading')

    // Wait for effect to run.
    await act(async () => {
      await new Promise(r => setTimeout(r, 10))
    })

    // Verify buildParams was called with the initial filters and page.
    expect(buildParams).toHaveBeenCalledWith({ queue: 'test' }, 1)
    // Verify fetchFn was called with the built params and an AbortSignal.
    expect(fetchFn).toHaveBeenCalledWith({ page: 1, per_page: 25, queue: 'test' }, expect.any(AbortSignal))
    // The hook should transition to ready after a successful fetch.
    expect(result.current.phase).toBe('ready')
  })

  it('resets page to 1 when filter changes', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: { rows: [], total: 0, page: 1, last_page: 1 } })
    const buildParams = vi.fn().mockReturnValue({ page: 1, per_page: 25 })

    const { result } = renderHook(() =>
      useJobsQuery({
        fetchFn,
        buildParams,
        initialFilters: { queue: '' },
      })
    )

    // Set page to 2.
    act(() => {
      result.current.setPage(2)
    })
    expect(result.current.page).toBe(2)

    // Change filter; page resets to 1.
    act(() => {
      result.current.setFilter('queue', 'new_queue')
    })
    expect(result.current.page).toBe(1)
    expect(result.current.filters.queue).toBe('new_queue')
  })

  it('calls onResult callback after fetch and before setting result', async () => {
    const mockResponse = { data: { rows: [], total: 0, page: 1, last_page: 1, truncated: true } }
    const fetchFn = vi.fn().mockResolvedValue(mockResponse)
    const buildParams = vi.fn().mockReturnValue({ page: 1, per_page: 25 })
    const onResult = vi.fn()

    renderHook(() =>
      useJobsQuery({
        fetchFn,
        buildParams,
        initialFilters: {},
        onResult,
      })
    )

    await act(async () => {
      await new Promise(r => setTimeout(r, 10))
    })

    // Verify onResult was called with the response.
    expect(onResult).toHaveBeenCalledWith(mockResponse)
  })
})
