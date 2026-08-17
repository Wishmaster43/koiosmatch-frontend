/**
 * useAccountManagersReport — data layer for AccountManagersReport: loads
 * GET /reports/accountmanagers for the given period (mirrors useRecruitersReport).
 *
 * `months`/`contract_ending_days` are explicit escapes from a tenant SETTING
 * (customer_no_contact_days, customer_contract_ending_days) — undefined means
 * "use the tenant's own setting", never a client-guessed default (§0 no
 * fabricated numbers). `accountManagersOverrideParams` is the ONE place these
 * two keys are read from; the report component reuses it verbatim to build the
 * compare call's extraParams, so an override can never reach one window/call and
 * not the other (backend K-67: the two halves must measure the same threshold).
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { AccountManagersReportData, ReportPeriod } from '@/types/analytics'

export interface AccountManagersOverrides {
  months?: number
  contractEndingDays?: number
}

// Turns the override state into the exact backend query keys — shared by the
// plain fetch below and the report's own compare extraParams.
export function accountManagersOverrideParams(overrides: AccountManagersOverrides): Record<string, number> {
  const params: Record<string, number> = {}
  if (overrides.months != null) params.months = overrides.months
  if (overrides.contractEndingDays != null) params.contract_ending_days = overrides.contractEndingDays
  return params
}

export function useAccountManagersReport(period: ReportPeriod, overrides: AccountManagersOverrides = {}) {
  const overrideParams = accountManagersOverrideParams(overrides)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', 'accountmanagers', period, overrideParams],
    queryFn: async ({ signal }) =>
      ((await api.get('/reports/accountmanagers', { params: { period, ...overrideParams }, signal })).data ?? null) as AccountManagersReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError, refetch }
}
