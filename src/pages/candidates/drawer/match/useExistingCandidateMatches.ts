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
 * NOTE (list vs detail): MatchListResource does NOT serialise `hours_per_week`
 * (only MatchDetailResource does) — verified against the backend resource. The
 * overlap check below can therefore only ever warn on the DATE overlap, never
 * escalate on a combined hours-per-week sum, without an extra per-match detail
 * fetch this hook deliberately does not add (see the PR notes for the CMBE
 * ticket: expose hours_per_week on the list resource, or a scoped fields param).
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
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
          })))
      })
      .catch(() => { if (alive) setMatches([]) })
    return () => { alive = false }
  }, [candidateId, editMatchId])

  return matches
}
