/**
 * useReportCandidates — data layer for the ShiftManager candidates report.
 * Fetches /sm_candidates (page size from KPI settings) and exposes
 * { candidates, loading, error }. `error` is a boolean; the component maps it to
 * a translated message so i18n stays in the view (§3, §5). Refetches when the
 * configured page size changes; cancels on unmount.
 */
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import type { ReportCandidate } from '@/types/reports'

// Normalise API field spellings: the resource returns first_name/last_name while
// the report reads firstname/lastname ("Onbekend" otherwise). Accept both so a
// backend rename never blanks the drill-down again. Shared with useSmCandidatesList.
export const normalizeSmCandidate = (r: Record<string, unknown>): ReportCandidate => ({
  ...r,
  firstname: (r.firstname ?? r.first_name) as string | undefined,
  lastname:  (r.lastname ?? r.last_name) as string | undefined,
  phone:     (r.phone ?? r.mobile) as string | undefined,
})

export function useReportCandidates(perPage: number): { candidates: ReportCandidate[]; loading: boolean; error: boolean } {
  const [candidates, setCandidates] = useState<ReportCandidate[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true); setError(false)
    api.get(`/sm_candidates?per_page=${perPage}`)
      .then(res => {
        if (!active) return
        const body = res.data
        const rows = (Array.isArray(body) ? body : (body?.data ?? [])) as Array<Record<string, unknown>>
        setCandidates(rows.map(normalizeSmCandidate))
      })
      .catch(() => { if (active) setError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [perPage])

  return { candidates, loading, error }
}
