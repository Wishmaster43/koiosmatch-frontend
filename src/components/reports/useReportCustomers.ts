/**
 * useReportCustomers — data layer for the Shiftmanager customers report table.
 * Delegates to the shared full-set fetch (useSmCustomerTree) so the endpoint has a
 * single implementation; exposes { customers, loading, error, truncated }. `error`
 * is a boolean; the view maps it to a translated message (§3, §5).
 */
import { useSmCustomerTree } from '@/hooks/useSmCustomerTree'
import type { ReportCustomer } from '@/types/reports'

// Fetches all Shiftmanager customers for the reports table.
export function useReportCustomers(): { customers: ReportCustomer[]; loading: boolean; error: boolean; truncated: boolean } {
  return useSmCustomerTree()
}
