/**
 * useWhatsappReport — data layer for WhatsappReport: loads GET /reports/whatsapp
 * (LIVE, CMBE f7a2c6f8 — envelope nests the window under `meta`) for the given
 * period (+ WAVE 1c owner/direction/escalated panel filters) and exposes the
 * four UI states. Mirrors useOutreachReport (react-query, cached per period+
 * filters, a stale request cancels). `enabled` lets the reports-hub tile skip
 * the fetch entirely for a tenant without the whatsapp module — the route sits
 * behind module:whatsapp, so firing it would only ever 403.
 *
 * WHATSAPP-NARROW-1: the route's own rule set drops status[]/location_id[]
 * (ReportController.php panelFilterRulesExcept(['location_id','status'])) —
 * `buildReportQueryParams` already knows this (reportFilterParams.ts's
 * `acceptsStatusBranchFilter`), so only owner_id[]/direction[]/escalated ever
 * reach this endpoint.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { buildReportQueryParams, EMPTY_REPORT_FILTERS } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import type { WhatsappReportData, ReportPeriod } from '@/types/analytics'

// Data layer for the WhatsApp report (see the module doc above); `enabled` lets a tenant without the module skip firing a request that would only ever 403.
export function useWhatsappReport(period: ReportPeriod, enabled = true, filters: ReportFilterState = EMPTY_REPORT_FILTERS) {
  const params = buildReportQueryParams(period, 'whatsapp', filters)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', 'whatsapp', params],
    enabled,
    queryFn: async ({ signal }) => ((await api.get('/reports/whatsapp', { params, signal })).data ?? null) as WhatsappReportData | null,
  })
  return { data: data ?? null, loading: enabled && isLoading, error: isError, refetch }
}
