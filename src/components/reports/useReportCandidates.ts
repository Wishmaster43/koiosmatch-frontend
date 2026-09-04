/**
 * useReportCandidates — data layer for the Shiftmanager candidates report.
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

// PERF-1/SM-STATS-2 (audit): the tenant's `candidates_per_page` KPI setting caps this
// fetch (server hard cap 500, PageSize::from at SmCandidateController::index). The
// header pills (active/deregistered/total) and the KPI-row counts have since moved
// off these rows onto GET /sm_candidates/stats (useSmCandidateStats) — one server-
// computed COUNT per bucket, so they never undercount past this page's cap. This
// hook still backs what stats genuinely cannot serve: the position/login/month/week/
// city CHARTS and their drill-downs (filter-interactive on the position+status panel,
// which the stats route has no `position` param for and only a single-value `status`
// param — SmCandidateController::stats), and every per-row drill-down list. Those stay
// row-derived and honour the configured `candidates_per_page` cap honestly (never
// "uncapped"/"full set" — on a tenant past 500 candidates these charts/drill-downs
// describe the first `candidates_per_page` rows, not the tenant). A full fix needs the
// stats endpoint to grow a `position` param and multi-value `status` — flagged as
// SM-STATS-3, alongside the per-candidate breakdowns (no-shows/cancellations/ending-
// soon/last-login granularity) SmCandidatesInsightsRow and ShiftmanagerDashboard still
// need rows for.

// Data layer for the SM candidates report (see the module doc above); normalises the two known field spellings so a backend rename never blanks the drill-down.
export function useReportCandidates(perPage: number): { candidates: ReportCandidate[]; loading: boolean; error: boolean } {
  const [candidates, setCandidates] = useState<ReportCandidate[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(false)

  // Refetches whenever the configured page size changes; the alive guard drops the response if a new perPage arrives (or the component unmounts) before it resolves.
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
