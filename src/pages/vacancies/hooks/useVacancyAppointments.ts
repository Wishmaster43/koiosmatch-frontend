/**
 * useVacancyAppointments — AFSPRAKEN-VACATURE-1: loads every appointment tied to
 * this vacancy across ALL candidates (GET /vacancies/{id}/appointments, gated
 * server-side on vacancies.view). Server-paginated, ordered by date; fetch/map/paging
 * is the shared useAppointmentsPage (X-38 lifted it out so the customer tab could reuse it).
 */
import { useAppointmentsPage, APPOINTMENTS_PER_PAGE } from '@/hooks/useAppointmentsPage'
import type { Id } from '@/types/common'

export const VACANCY_APPOINTMENTS_PER_PAGE = APPOINTMENTS_PER_PAGE

// One server page of this vacancy's appointments across all candidates; idle without an id.
export function useVacancyAppointments(vacancyId?: Id, page = 1) {
  return useAppointmentsPage({
    queryKey: ['vacancies', vacancyId, 'appointments'], url: `/vacancies/${vacancyId}/appointments`,
    page, enabled: !!vacancyId,
  })
}
