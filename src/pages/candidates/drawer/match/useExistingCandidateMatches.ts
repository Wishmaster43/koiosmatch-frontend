/**
 * useExistingCandidateMatches — the candidate's own matches, fetched for the
 * duplicate + overlap preflight (points 5/6, Danny's ten-point round: 1.10/1.11).
 * Reuses the REAL, already-validated endpoint (GET /matches?candidate_id=) —
 * MatchController::index accepts `candidate_id` directly (the same filter the
 * general Matches page/customer drilldown route through for their own scoped
 * views), no new backend surface. A 404/failed request is an empty list, never a
 * hard error (mirrors useMatches). The match currently being EDITED is excluded
 * so an edit never warns against itself. Archived matches are excluded by the
 * endpoint's own default scope (no `include_archived` sent) — the same
 * soft-delete default every other list in this app uses.
 *
 * MATCH-LIST-HOURS-1 (landed): MatchListResource now serialises `hours_per_week`
 * too (previously only MatchDetailResource did) — verified against the backend
 * resource, no extra per-match detail fetch needed. It feeds the overlap
 * banner's hours-sum escalation (`overlapHoursSum` in matchConflicts.ts): once
 * both the drafted match and an overlapping existing one carry hours, a
 * combined week over full-time reads as a real double-booking risk, not just a
 * date coincidence. `hours_per_week` is a `decimal:2`-cast column, so Laravel
 * serialises it as a JSON *string* (§10) — coerced tolerantly below via the
 * house's `toCoord`-style helper, never a `typeof x === 'number'` check.
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import { toCoord } from '@/lib/coords'
import type { Id } from '@/types/common'
import type { ExistingMatchRow } from './matchConflicts'

// The raw /matches list row fields this hook reads (MatchListResource, verified).
interface RawMatchListRow {
  id: Id
  vacancy?: { title?: string } | null
  client_name?: string | null
  customer_id?: Id | null
  customer_location_id?: Id | null
  customer_department_id?: Id | null
  status?: string | null
  start_date?: string | null
  end_date?: string | null
  hours_per_week?: number | string | null
}

export function useExistingCandidateMatches(candidateId: string, editMatchId?: Id): ExistingMatchRow[] {
  const [matches, setMatches] = useState<ExistingMatchRow[]>([])

  useEffect(() => {
    if (!candidateId) { setMatches([]); return }
    let alive = true
    api.get('/matches', { params: { candidate_id: candidateId, per_page: 100 } })
      .then(r => {
        if (!alive) return
        const { rows } = unwrapList<RawMatchListRow>(r)
        setMatches(rows
          // Never warn a match against itself while editing it.
          .filter(m => String(m.id) !== String(editMatchId ?? ''))
          .map(m => ({
            id: m.id,
            vacancyTitle: m.vacancy?.title ?? null,
            client: m.client_name ?? null,
            customerId: m.customer_id != null ? String(m.customer_id) : null,
            customerLocationId: m.customer_location_id != null ? String(m.customer_location_id) : null,
            customerDepartmentId: m.customer_department_id != null ? String(m.customer_department_id) : null,
            status: m.status ?? null,
            startDate: m.start_date ?? null,
            endDate: m.end_date ?? null,
            hoursPerWeek: toCoord(m.hours_per_week),
          })))
      })
      .catch(() => { if (alive) setMatches([]) })
    return () => { alive = false }
  }, [candidateId, editMatchId])

  return matches
}
