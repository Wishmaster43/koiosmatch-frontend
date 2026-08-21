/**
 * useApplicationVacancy — S31-style shared React Query hook for the application
 * drawer's linked vacancy DETAIL (GET /vacancies/{id}), mirroring
 * useCandidateCvDocument.ts exactly (§11: land a new shared helper WITH adoption
 * at the existing copy site, never next to it — VacancyTab used to run its own
 * useEffect/useState/api.get for this same fetch).
 *
 * React Query (K-33): cached per vacancy id, only enabled once a vacancy is
 * actually linked (data minimisation, §8/§9) — CompetitionBlock and VacancyTab
 * both read the SAME cache entry, so opening either tab reuses the other's fetch.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'
import { mapVacancyDetail } from '@/pages/vacancies/shared'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

export function useApplicationVacancy(vacancyId: Id | null | undefined) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['vacancies', vacancyId, 'detail'],
    enabled: vacancyId != null,
    queryFn: async ({ signal }) => mapVacancyDetail(unwrap(await api.get(`/vacancies/${vacancyId}`, { signal }))),
  })

  return {
    vacancy: (data ?? null) as VacancyDetail | null,
    loading: vacancyId != null && isLoading,
    error: vacancyId != null && isError,
  }
}
