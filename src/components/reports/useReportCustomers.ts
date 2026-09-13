/**
 * useReportCustomers — data layer for the Shiftmanager customers report table.
 * Fetches /sm_customers once and exposes { customers, loading, error }. `error`
 * is a boolean; the view maps it to a translated message so i18n stays in the
 * component (§3, §5). Cancels on unmount.
 */
import type { AxiosResponse } from 'axios'
import { unwrapList } from '@/lib/api'
import type { ReportCustomer } from '@/types/reports'
import { useAliveListFetch } from './useAliveListFetch'

// Module-scope (stable reference) so useAliveListFetch's effect never sees it as a changed dep.
const mapSmCustomersResponse = (res: AxiosResponse): ReportCustomer[] => unwrapList<ReportCustomer>(res).rows

// Fetches Shiftmanager customers for the reports table.
export function useReportCustomers(): { customers: ReportCustomer[]; loading: boolean; error: boolean } {
  const { data: customers, loading, error } = useAliveListFetch('/sm_customers', mapSmCustomersResponse)
  return { customers, loading, error }
}
