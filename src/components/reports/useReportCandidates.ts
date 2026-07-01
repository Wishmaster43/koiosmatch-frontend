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

export function useReportCandidates(perPage: number): { candidates: ReportCandidate[]; loading: boolean; error: boolean } {
  const [candidates, setCandidates] = useState<ReportCandidate[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true); setError(false)
    api.get(`/sm_candidates?per_page=${perPage}`)
      .then(res => { if (!active) return; const body = res.data; setCandidates(Array.isArray(body) ? body : (body?.data ?? [])) })
      .catch(() => { if (active) setError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [perPage])

  return { candidates, loading, error }
}
