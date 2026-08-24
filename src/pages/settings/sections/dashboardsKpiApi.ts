/**
 * dashboardsKpiApi — thin wrapper around the K-173 phase-4 KPI-catalog endpoints
 * (K3-REFIT-1). One list per role carries order AND on/off at once: omission
 * from `kpis` means hidden, an unknown key 422s, an unknown role 404s.
 *
 * Type-gen adoption (CLAUDE.md §10): the generated spec (`api-generated.ts`,
 * 84cb1baf) documents the PUT request body (`{ kpis?: string[] }`) but carries
 * no 2xx response schema for any of these three routes (only 401) — so the
 * response shapes below (`KpiCatalog`, `RoleKpisResponse`) are hand-written
 * from the brief's contract, not generated.
 */
import api, { unwrap } from '@/lib/api'
import type { operations } from '@/types/api-generated'
import { serverKeysToLocal, localIdsToServer, SERVER_TO_LOCAL } from '@/pages/dashboard/shared'

// Request body shape for PUT /dashboard/kpis/{role} — lifted from the generated spec.
type PutKpisBody = NonNullable<operations['putDashboardKpisRole']['requestBody']>['content']['application/json']

// One entry in the KPI vocabulary — the uitleg fields this screen renders per
// row. `key` is translated to the LOCAL tile id at this boundary (kpiKeyMap):
// the whole screen thinks in local ids, only the wire speaks server keys.
export interface DashboardKpiCatalogEntry {
  key: string
  label: string
  counts: string
  scope: string
  drills_to: string
}
export interface DashboardKpiCatalog {
  available: DashboardKpiCatalogEntry[]
  defaults: Record<string, string[]>
}

// GET /dashboard/kpi-catalog — the KPI vocabulary + per-role defaults, keys
// translated server→local at this seam; entries this build has no tile for are
// dropped (they cannot render or be toggled anyway).
export const fetchDashboardKpiCatalog = (signal?: AbortSignal): Promise<DashboardKpiCatalog> =>
  api.get('/dashboard/kpi-catalog', { signal }).then((res) => {
    const raw = unwrap<DashboardKpiCatalog>(res) ?? { available: [], defaults: {} }
    return {
      available: raw.available
        .filter(e => SERVER_TO_LOCAL[e.key] != null)
        .map(e => ({ ...e, key: SERVER_TO_LOCAL[e.key] })),
      defaults: Object.fromEntries(Object.entries(raw.defaults).map(([role, keys]) => [role, serverKeysToLocal(keys)])),
    }
  })

// GET /dashboard/kpis/{role} — the tenant's current ordered+visible list for
// one role, translated server→local at this seam.
export const fetchDashboardKpisRole = (role: string, signal?: AbortSignal): Promise<string[]> =>
  api.get(`/dashboard/kpis/${role}`, { signal }).then((res) => serverKeysToLocal(unwrap<{ kpis?: string[] }>(res)?.kpis ?? []))

// PUT /dashboard/kpis/{role} — persist one role's FULL ordered+visible list
// (settings.update). Takes LOCAL tile ids; the wire gets server keys — an
// unknown key would 422 (the exact B1 failure this seam exists to prevent).
export const putDashboardKpisRole = (role: string, kpis: string[]): Promise<void> => {
  const body: PutKpisBody = { kpis: localIdsToServer(kpis) }
  return api.put(`/dashboard/kpis/${role}`, body).then(() => undefined)
}
