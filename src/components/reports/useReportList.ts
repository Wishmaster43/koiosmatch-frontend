import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'

/**
 * useReportList — generic read-only list loader for the single-endpoint report
 * tables (runs, messages, …). Fetches `url` once, unwraps `{ data }` / a bare
 * array, and exposes `{ rows, loading, error }`. A failed request sets `error`
 * (audit r2-ui-states-2: it used to collapse into the empty state, so a broken
 * endpoint read as "no rows yet"). Cancels on unmount.
 *
 * Optional `baseURL` override lets a workflow-EXECUTION caller (runs list) point
 * this generic loader at the configurable workflow base (VITE_WORKFLOW_API_URL,
 * lib/workflowApi) instead of the main api client's default — every other caller
 * (messages, …) leaves it unset and keeps today's behaviour.
 */
export function useReportList<T>(url: string, baseURL?: string): { rows: T[]; loading: boolean; error: boolean } {
  const [rows,    setRows]    = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  // Fetches `url` once; the `active` guard drops a stale response after unmount
  // or a url change. A failure clears the rows AND raises the error flag.
  useEffect(() => {
    let active = true
    setError(false)
    api.get(url, baseURL ? { baseURL } : undefined)
      .then(res => { if (active) setRows(unwrapList<T>(res).rows) })
      .catch(() => { if (active) { setRows([]); setError(true) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [url, baseURL])

  return { rows, loading, error }
}
