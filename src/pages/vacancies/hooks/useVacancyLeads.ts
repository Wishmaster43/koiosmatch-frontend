/**
 * useVacancyLeads — GET /vacancies/{id}/leads (VAC-LEADS-1, VacancyController::leads).
 * POPULATION NOTE (V14): this is a DIFFERENT set of candidates than the table's
 * `leadsCount` cell value, which comes from the separate /candidate-matches
 * search endpoint (score-ranked, radius-filtered "Kandidaten zoeken" tab). This
 * endpoint instead returns candidates with an APPOINTMENT booked for this vacancy
 * who have no formal application to it yet (VacancyQuery::leads — see
 * VacancyLeadResource). The expandable panel below the count cell shows THIS
 * appointment-tied population; the count cell's own number and this list's row
 * count can legitimately differ. Disabled until `enabled` is true, so the
 * request only fires once a row is actually expanded (§9 lazy load).
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

export interface VacancyLeadRow {
  id: Id
  name: string
  phase: string | null
  source: string | null
  createdAt: string | null
}

// Raw wire row (VacancyLeadResource) — read tolerantly, snake_case.
interface RawVacancyLead {
  id?: Id
  name?: string
  phase?: string | null
  source?: string | null
  created_at?: string | null
}

function mapVacancyLead(raw: RawVacancyLead): VacancyLeadRow {
  return {
    id: raw.id as Id,
    name: raw.name ?? '',
    phase: raw.phase ?? null,
    source: raw.source ?? null,
    createdAt: raw.created_at ?? null,
  }
}

// Lazy, read-only fetch of the appointment-tied leads list for one vacancy — only
// enabled while the caller has actually expanded the row (see module doc above).
export function useVacancyLeads(vacancyId: Id | undefined, enabled: boolean) {
  const { data = [], isLoading: loading, isError: error } = useQuery({
    queryKey: ['vacancies', vacancyId, 'leads'],
    enabled: !!vacancyId && enabled,
    queryFn: async ({ signal }): Promise<VacancyLeadRow[]> =>
      unwrapList<RawVacancyLead>(await api.get(`/vacancies/${vacancyId}/leads`, { params: { per_page: 100 }, signal })).rows.map(mapVacancyLead),
  })
  return { rows: data, loading, error }
}

// POST /vacancies/{id}/leads/recount — queue a rescan of AI-suggested candidates for
// one vacancy. Returns 202 {status:'queued'} or 429 when throttled (20/min).
export function useRecountVacancyLeads() {
  const mutate = async (vacancyId: Id): Promise<{ status: string }> => {
    const resp = await api.post(`/vacancies/${vacancyId}/leads/recount`, {}, { quietStatuses: [429] })
    return resp.data
  }

  return { mutate }
}
