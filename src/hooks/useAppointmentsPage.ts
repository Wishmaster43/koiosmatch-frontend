/**
 * useAppointmentsPage — one server page of appointments for an entity drawer's Afspraken tab
 * (vacancy: GET /vacancies/{id}/appointments; customer: GET /appointments?customer_id=), mapped
 * through the shared AppointmentResource mapper. The list is server-paginated and never
 * accumulated client-side; the entity hooks only choose route, params and query key.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import { mapVacancyAppointment } from '@/types/vacancyAppointment'
import type { RawVacancyAppointment, VacancyAppointmentRow } from '@/types/vacancyAppointment'

export const APPOINTMENTS_PER_PAGE = 20

interface AppointmentsPage { rows: VacancyAppointmentRow[]; total: number; page: number; lastPage: number; loading: boolean; error: boolean }

// Fetch + map one page; `enabled` false (no id / no permission) returns an empty, idle page.
export function useAppointmentsPage({ queryKey, url, params, page = 1, enabled = true }: {
  queryKey: readonly unknown[]; url: string; params?: Record<string, unknown>; page?: number; enabled?: boolean
}): AppointmentsPage {
  const { data, isLoading: loading, isError: error } = useQuery({
    queryKey: [...queryKey, page],
    enabled,
    queryFn: async ({ signal }) =>
      unwrapList<RawVacancyAppointment>(await api.get(url, { params: { ...(params ?? {}), page, per_page: APPOINTMENTS_PER_PAGE }, signal })),
  })
  const rows = (data?.rows ?? []).map(mapVacancyAppointment)
  return { rows, total: data?.total ?? 0, page: data?.page ?? page, lastPage: data?.lastPage ?? 1, loading, error }
}
