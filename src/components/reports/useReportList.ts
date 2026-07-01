/**
 * useReportList — generic read-only list loader for the single-endpoint report
 * tables (runs, messages, …). Fetches `url` once, unwraps `{ data }` / a bare
 * array, and exposes `{ rows, loading }`. Any error is an empty list, not a
 * thrown state — the table renders its own empty state (§3). Cancels on unmount.
 */
import { useState, useEffect } from 'react'
import api from '@/lib/api'

export function useReportList<T>(url: string): { rows: T[]; loading: boolean } {
  const [rows,    setRows]    = useState<T[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.get(url)
      .then(res => { if (active) setRows(res.data?.data ?? res.data ?? []) })
      .catch(() => { if (active) setRows([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [url])

  return { rows, loading }
}
