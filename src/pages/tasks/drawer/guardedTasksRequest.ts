import type { MutableRefObject } from 'react'
import { unwrapList } from '@/lib/api'

/**
 * runGuardedTasksRequest — the request-id-guarded `.then/.catch/.finally` chain
 * shared by RelatedTasks and SubtasksSection (DRY round, CANDTABS package):
 * both fetch `GET /tasks` and drop a slow response once a newer request (or a
 * host that has moved past this task) supersedes it — a 404 is swallowed
 * (task-scoped lookups return it for "no related rows", not a real error).
 * `mapRows` lets a caller post-process the raw rows (RelatedTasks filters out
 * the task itself) without duplicating the guard around it.
 */
export function runGuardedTasksRequest<T>(
  promise: Promise<{ data: unknown }>,
  opts: {
    requestIdRef: MutableRefObject<number>
    requestId: number
    setRows: (rows: T[]) => void
    setError: (v: boolean) => void
    setLoading: (v: boolean) => void
    mapRows?: (rows: T[]) => T[]
  },
): void {
  const { requestIdRef, requestId, setRows, setError, setLoading, mapRows } = opts
  promise
    .then(r => {
      if (requestIdRef.current !== requestId) return
      const rows = unwrapList(r).rows as T[]
      setRows(mapRows ? mapRows(rows) : rows)
    })
    .catch((err: { response?: { status?: number } }) => {
      if (requestIdRef.current === requestId && err?.response?.status !== 404) setError(true)
    })
    .finally(() => { if (requestIdRef.current === requestId) setLoading(false) })
}
