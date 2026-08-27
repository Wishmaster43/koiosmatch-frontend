/**
 * useTaskLite — minimal task identity fetch for the second-screen notes popout
 * (NOTITIE-POPOUT-EDIT-1 generalisation, mirrors useVacancyLite). `GET
 * /tasks/{id}` is the only single-record endpoint the API exposes, so this
 * reuses it but reads only the title off the raw response — the popout window's
 * title/header never pays for mapping the whole task (assignee/subtasks/…).
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'
import { initialsOf } from '@/lib/initials'

export interface TaskLite { id: string; name: string; initials: string }

// The subset of the raw task resource this hook actually reads.
interface RawTaskLite { id?: string | number; title?: string }

// Minimal task identity (id/name/initials) for the second-screen popout's title/header.
export function useTaskLite(id: string | undefined) {
  const { data: task = null, isLoading: loading, isError: error, refetch: reload } = useQuery({
    queryKey: ['tasks', id, 'lite'],
    enabled: !!id,
    queryFn: async ({ signal }): Promise<TaskLite> => {
      const raw = unwrap<RawTaskLite>(await api.get(`/tasks/${id}`, { signal }))
      const name = raw.title || '?'
      return { id: String(raw.id ?? id), name, initials: initialsOf(name) }
    },
  })
  return { task, loading, error, reload }
}
