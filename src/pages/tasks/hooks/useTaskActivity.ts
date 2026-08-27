/**
 * useTaskActivity — the task audit trail (who changed what, when). Thin typed
 * wrapper around the shared useEntityActivity (src/hooks/) — fetches
 * GET /tasks/{id}/activity. Mirrors useMatchActivity/useApplicationActivity so
 * every entity's changelog behaves identically (§3A).
 */
import { useEntityActivity } from '@/hooks/useEntityActivity'
import type { EntityActivityEvent, UseEntityActivityResult } from '@/hooks/useEntityActivity'
import type { Id } from '@/types/common'

export type TaskActivityEvent = EntityActivityEvent

// Fetches the task's audit trail (see file docblock above).
export function useTaskActivity(id?: Id): UseEntityActivityResult<TaskActivityEvent> {
  return useEntityActivity<TaskActivityEvent>('tasks', id)
}
