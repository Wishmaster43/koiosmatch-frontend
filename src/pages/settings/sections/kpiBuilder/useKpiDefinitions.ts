/**
 * useKpiDefinitions — a tenant's own KPI rows for one entity (GET /kpi-definitions
 * ?entity=). Deliberately never passes `active`: an inactive row must still show
 * in the settings list (only the report band hides it) — the entity panel is the
 * only place a tenant can flip it back on. Server order is kept as-is (drag/
 * keyboard reorder persists that same order via putKpiDefinitionsOrder).
 *
 * useKpiDefinitionTotal reads every entity's rows to count the tenant-wide cap
 * (KPI_CAP_PER_TENANT) independently of which entity tab is open.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchKpiDefinitions } from './kpiDefinitionsApi'
import type { KpiDefinition, KpiEntity } from './kpiDefinitionsApi'

export function useKpiDefinitions(entity: KpiEntity) {
  return useQuery({
    queryKey: ['kpi-definitions', entity],
    queryFn: ({ signal }) => fetchKpiDefinitions({ entity }, signal),
    staleTime: 60_000,
    retry: 1,
  })
}

// Tenant-wide active count, used by the entity panel to gate the "+ KPI" button
// against KPI_CAP_PER_TENANT regardless of which entity tab is currently open.
export function useKpiDefinitionTotal() {
  return useQuery({
    queryKey: ['kpi-definitions', 'all'],
    queryFn: ({ signal }) => fetchKpiDefinitions({}, signal),
    select: (rows: KpiDefinition[]) => rows.filter(r => r.active).length,
    staleTime: 60_000,
    retry: 1,
  })
}
