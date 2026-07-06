/**
 * useDrillDownShifts — data layer for ShiftsDrillDownDrawer (§3): loads ALL the
 * shifts behind a chart/KPI data point from the given URL. The detail endpoint
 * paginates (default 50, max 500), so we page through and concatenate — otherwise
 * the drawer showed only 50 and, worse, the grouped totals only summed those 50
 * (Danny: "Hoezo maar 50?"). Aborts a stale request when the URL changes/unmounts.
 */
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import type { ShiftRow } from '@/types/shiftmanager'

const PER_PAGE = 500  // endpoint cap — keeps the number of round-trips minimal.

// Pull the row array out of either a paginated envelope or a bare array.
const rowsOf = (body: unknown): ShiftRow[] => {
  const data = (body as { data?: unknown })?.data ?? body ?? []
  return Array.isArray(data) ? (data as ShiftRow[]) : []
}

export function useDrillDownShifts(fetchUrl: string) {
  const [shifts,  setShifts]  = useState<ShiftRow[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (!fetchUrl) return
    let active = true
    setLoading(true)
    setError(false)
    const sep = fetchUrl.includes('?') ? '&' : '?'
    const page = (n: number) => api.get(`${fetchUrl}${sep}per_page=${PER_PAGE}&page=${n}`).then(r => r.data)

    ;(async () => {
      try {
        const first    = await page(1)
        const lastPage = Math.max(1, Number(first?.last_page ?? 1))
        let all        = rowsOf(first)
        // Fetch the remaining pages in parallel and append them in order.
        if (lastPage > 1) {
          const rest = await Promise.all(Array.from({ length: lastPage - 1 }, (_, i) => page(i + 2)))
          all = rest.reduce<ShiftRow[]>((acc, body) => acc.concat(rowsOf(body)), all)
        }
        if (active) { setShifts(all); setTotal(Number(first?.total ?? all.length)) }
      } catch {
        if (active) { setError(true); setShifts([]); setTotal(0) }
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => { active = false }
  }, [fetchUrl])

  return { shifts, total, loading, error }
}
