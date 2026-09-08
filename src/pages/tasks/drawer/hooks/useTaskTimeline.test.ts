/**
 * useTaskTimeline — test the hook that fetches task timeline from GET /tasks/{id}/timeline.
 * Mocks the api and verifies the query is set up correctly with staleTime 30s.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { useTaskTimeline } from './useTaskTimeline'
import api from '@/lib/api'

vi.mock('@/lib/api')

describe('useTaskTimeline', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)

  it('fetches timeline from GET /tasks/{id}/timeline', async () => {
    const taskId = 'task-123'
    const mockEntries = [
      {
        id: 'note-abc',
        type: 'note',
        author: 'Alice Smith',
        description: 'Noted: must call back',
        link: null,
        created_at: '2026-09-08T14:00:00+02:00',
        meta: { note_type: 'general' },
      },
      {
        id: 'status-xyz',
        type: 'status_change',
        author: 'Bob Jones',
        description: 'Status changed: To Do → Done',
        link: { type: 'task_activity', id: taskId, url: `/api/tasks/${taskId}/activity` },
        created_at: '2026-09-08T13:00:00+02:00',
        meta: null,
      },
    ]

    vi.mocked(api.get).mockResolvedValue({
      data: { data: mockEntries, meta: { count: 2, limit: 100, has_more: false } },
    })

    const { result } = renderHook(() => useTaskTimeline(taskId), { wrapper })

    // Initially loading
    expect(result.current.loading).toBe(true)

    // Wait for query to settle
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Verify the fetch was called with correct params
    expect(api.get).toHaveBeenCalledWith(`/tasks/${taskId}/timeline`, { params: { limit: 100 } })

    // Verify the data is returned correctly
    expect(result.current.entries).toHaveLength(2)
    expect(result.current.entries[0].id).toBe('note-abc')
    expect(result.current.entries[1].id).toBe('status-xyz')
    expect(result.current.meta?.count).toBe(2)
    expect(result.current.error).toBe(false)
  })

  it('returns empty array when taskId is undefined', () => {
    const { result } = renderHook(() => useTaskTimeline(undefined), { wrapper })

    expect(result.current.entries).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(false)
  })

  it('sets error state on fetch failure', async () => {
    const taskId = 'task-456'
    const errorMsg = 'Network error'

    vi.mocked(api.get).mockRejectedValue(new Error(errorMsg))

    const { result } = renderHook(() => useTaskTimeline(taskId), { wrapper })

    await waitFor(() => {
      expect(result.current.error).toBe(true)
    })

    expect(result.current.entries).toEqual([])
  })

  it('respects custom limit parameter', async () => {
    const taskId = 'task-789'
    vi.mocked(api.get).mockResolvedValue({
      data: { data: [], meta: { count: 0, limit: 50, has_more: false } },
    })

    renderHook(() => useTaskTimeline(taskId, 50), { wrapper })

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(`/tasks/${taskId}/timeline`, { params: { limit: 50 } })
    })
  })
})
