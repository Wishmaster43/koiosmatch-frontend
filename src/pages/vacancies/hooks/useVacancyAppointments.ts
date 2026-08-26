/**
 * useVacancyAppointments — AFSPRAKEN-VACATURE-1: loads every appointment tied to
 * this vacancy across ALL candidates (GET /vacancies/{id}/appointments, gated
 * server-side on vacancies.view). Server-paginated (`page`/`per_page`), ordered
 * by date — this hook only forwards the current page, it never accumulates rows
 * client-side (mirrors useVacancyMatches' shape, but this endpoint is genuinely
 * paginated so page state stays here instead of being sliced from a full list).
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import { mapVacancyAppointment } from '@/types/vacancyAppointment'
import type { RawVacancyAppointment, VacancyAppointmentRow } from '@/types/vacancyAppointment'
import type { Id } from '@/types/common'

export const VACANCY_APPOINTMENTS_PER_PAGE = 20

// Loads one server page of this vacancy's appointments across all candidates
// (see file docblock above); rows are never accumulated client-side.
export function useVacancyAppointments(vacancyId?: Id, page = 1) {
  const { data, isLoading: loading, isError: error } = useQuery({
    queryKey: ['vacancies', vacancyId, 'appointments', page],
    enabled: !!vacancyId,
    queryFn: async ({ signal }) =>
      unwrapList<RawVacancyAppointment>(await api.get(`/vacancies/${vacancyId}/appointments`, {
        params: { page, per_page: VACANCY_APPOINTMENTS_PER_PAGE },
        signal,
      })),
  })

  const rows: VacancyAppointmentRow[] = (data?.rows ?? []).map(mapVacancyAppointment)
  return { rows, total: data?.total ?? 0, page: data?.page ?? page, lastPage: data?.lastPage ?? 1, loading, error }
}
