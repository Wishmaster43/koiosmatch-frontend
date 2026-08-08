/**
 * useTaskLookupIds — slug → uuid FK maps for task type/status/priority.
 *
 * TaskLookupsContext exposes each lookup's tenant-facing SLUG as `value` (the
 * real backend `id` is thrown away by its `normalize()` — a sibling lane owns
 * fixing that contract). But StoreTaskRequest/UpdateTaskRequest only validate
 * `type_id`/`status_id`/`priority_id` (uuid, exists:*) — they don't know the
 * slug keys `type`/`status`/`priority` at all, so any write built from the
 * context's `value` alone is silently dropped by Laravel's `validated()` (200
 * OK, field unchanged / falls back to the tenant default on create).
 *
 * This hook fetches the SAME raw lookup endpoints directly (bypassing the
 * context) and builds slug→uuid maps, mirroring the idiom AddTaskModal's edit
 * mode already used for its PATCH — hoisted here so every write path (create,
 * board drag, bulk actions) shares ONE copy instead of re-implementing it.
 */
import { useState, useEffect } from 'react'
import api, { unwrap } from '@/lib/api'

export interface TaskLookupIdMaps {
  type: Record<string, string>
  status: Record<string, string>
  priority: Record<string, string>
}

// A raw lookup row as the endpoint returns it — id = uuid FK, value = slug.
interface RawLookupRow { id?: string; value?: string }

// Build a slug → uuid map from a raw lookup list; rows missing either half are skipped.
function idMapOf(rows: unknown): Record<string, string> {
  return Object.fromEntries((Array.isArray(rows) ? (rows as RawLookupRow[]) : [])
    .filter((r): r is Required<RawLookupRow> => !!r?.id && !!r?.value)
    .map(r => [r.value, r.id]))
}

export function useTaskLookupIds(): { maps: TaskLookupIdMaps; loading: boolean } {
  const [maps, setMaps] = useState<TaskLookupIdMaps>({ type: {}, status: {}, priority: {} })
  const [loading, setLoading] = useState(true)

  // Fetch each raw lookup once; a failed/empty endpoint just leaves that map empty
  // (callers treat an unresolved slug as "nothing safe to send", never a guess).
  useEffect(() => {
    let alive = true
    Promise.all([
      api.get('/task-types').catch(() => ({ data: [] })),
      api.get('/task-statuses').catch(() => ({ data: [] })),
      api.get('/task-priorities').catch(() => ({ data: [] })),
    ]).then(([typesRes, statusesRes, prioritiesRes]) => {
      if (!alive) return
      setMaps({ type: idMapOf(unwrap(typesRes)), status: idMapOf(unwrap(statusesRes)), priority: idMapOf(unwrap(prioritiesRes)) })
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  return { maps, loading }
}
