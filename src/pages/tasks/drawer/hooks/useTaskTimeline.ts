/**
 * useTaskTimeline — fetch the merged timeline/activity feed for a task from
 * GET /tasks/{id}/timeline (§11 X-36). React-query with 30s staleTime;
 * reuses the shared EventTimeline component (identical to customer timeline).
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Id } from '@/types/common'

export interface TimelineEntry {
  id: string
  type: string
  author: string | null
  description: string
  link: { type: string; id: string; url: string } | null
  created_at: string
  meta: Record<string, unknown> | null
}

export interface TimelineResponse {
  data: TimelineEntry[]
  meta: { count: number; limit: number; has_more: boolean }
}

export function useTaskTimeline(taskId: Id | undefined, limit: number = 100) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['tasks', taskId, 'timeline'],
    queryFn: async () => {
      if (!taskId) return { data: [], meta: { count: 0, limit, has_more: false } }
      const res = await api.get<TimelineResponse>(`/tasks/${taskId}/timeline`, { params: { limit } })
      return res.data
    },
    staleTime: 30 * 1000, // 30 seconds
    enabled: !!taskId,
  })

  return {
    entries: data?.data ?? [],
    loading: isLoading,
    error: !!error,
    meta: data?.meta,
  }
}
