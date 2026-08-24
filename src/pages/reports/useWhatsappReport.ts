/**
 * useWhatsappReport — data layer for WhatsappReport: loads GET /reports/whatsapp
 * (LIVE, CMBE f7a2c6f8 — envelope nests the window under `meta`) for the given
 * period and exposes the four UI states. Mirrors useOutreachReport (react-query,
 * cached per period, a stale request cancels). `enabled` lets the reports-hub
 * tile skip the fetch entirely for a tenant without the whatsapp module — the
 * route sits behind module:whatsapp, so firing it would only ever 403.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { WhatsappReportData, ReportPeriod } from '@/types/analytics'

export function useWhatsappReport(period: ReportPeriod, enabled = true) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', 'whatsapp', period],
    enabled,
    queryFn: async ({ signal }) => ((await api.get('/reports/whatsapp', { params: { period }, signal })).data ?? null) as WhatsappReportData | null,
  })
  return { data: data ?? null, loading: enabled && isLoading, error: isError, refetch }
}
