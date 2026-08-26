/**
 * useVacancyMatches — loads this vacancy's matches (GET /vacancies/{id}/matches,
 * the dedicated read-only endpoint VacancyController::matches ships) and maps
 * them through the SAME shared mapMatch() the candidate/customer Matches tabs
 * use (§3A: extend, never fork). Read-only, so no reload/mutation surface —
 * mirrors useCustomerMatches's shape but stays disabled until an id is known.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import { mapMatch } from '@/pages/matches/shared'
import type { RawMatch, MatchRow } from '@/types/match'
import type { Id } from '@/types/common'

// Read-only vacancy matches (see the module doc above): mapped through the same shared mapMatch every other Matches tab uses, disabled until an id is known.
export function useVacancyMatches(vacancyId?: Id) {
  const { data = [], isLoading: loading, isError: error } = useQuery({
    queryKey: ['vacancies', vacancyId, 'matches'],
    enabled: !!vacancyId,
    queryFn: async ({ signal }): Promise<MatchRow[]> =>
      unwrapList<RawMatch>(await api.get(`/vacancies/${vacancyId}/matches`, { params: { per_page: 100 }, signal })).rows.map(mapMatch),
  })
  return { rows: data, loading, error }
}
