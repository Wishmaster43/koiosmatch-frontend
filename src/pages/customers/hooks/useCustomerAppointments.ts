/**
 * useCustomerAppointments — X-38 (AFSPRAKEN-PLEK-1): every appointment linked to this
 * customer through any of the four customer-side keys (customer_id, customer_location_id,
 * customer_department_id, contact_id). The server resolves that OR-set behind ONE filter,
 * `GET /appointments?customer_id=` (CMBE, wt-final 09-09) — the FE never pulls the tenant
 * list to filter client-side (§8). Fetch/map/paging is the shared useAppointmentsPage.
 */
import { useAppointmentsPage, APPOINTMENTS_PER_PAGE } from '@/hooks/useAppointmentsPage'
import type { Id } from '@/types/common'

export const CUSTOMER_APPOINTMENTS_PER_PAGE = APPOINTMENTS_PER_PAGE

// One server page of this customer's appointments; idle without a customer id.
export function useCustomerAppointments(customerId?: Id, page = 1) {
  return useAppointmentsPage({
    queryKey: ['customers', customerId, 'appointments'], url: '/appointments',
    params: { customer_id: customerId }, page, enabled: !!customerId,
  })
}
