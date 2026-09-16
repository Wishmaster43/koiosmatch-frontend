/**
 * useKpiMetrics — the per-entity metric registry (GET /kpi-metrics) driving
 * every picker in the KPI-builder form. Cached 5 minutes: the registry is
 * server-static per tenant (metric catalogue, not tenant data).
 */
import { useQuery } from '@tanstack/react-query'
import { fetchKpiMetrics } from './kpiDefinitionsApi'

export function useKpiMetrics() {
  return useQuery({
    queryKey: ['kpi-metrics'],
    queryFn: ({ signal }) => fetchKpiMetrics(signal),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}
