/**
 * kpiDefinitionsApi — thin wrapper around the tenant KPI-builder endpoints
 * (`/kpi-metrics`, `/kpi-definitions*`). Request shapes are typed from the
 * generated spec (`api-generated.ts`); the generated spec carries NO 2xx
 * response schema for any of these routes (§10 policy), so every response
 * type below is hand-written from the fields the screen actually reads.
 * One file, no React — the hooks in this folder own query state.
 */
import api, { unwrap, unwrapList } from '@/lib/api'
import type { operations } from '@/types/api-generated'

// Request shapes lifted from the generated spec — the write body is the same
// shape for create/patch (patch is a Partial), and the query type carries only
// `entity`/`active` (no `trashed`: a soft-deleted row is not listable — R3).
type WriteBody = NonNullable<operations['postKpiDefinitions']['requestBody']>['content']['application/json']
export type KpiEntity        = WriteBody['entity']
export type KpiUnit          = WriteBody['unit']
export type KpiComparison    = NonNullable<WriteBody['comparison']>
export type KpiSurface       = NonNullable<WriteBody['surfaces']>[number]
export type KpiDashboardRole = NonNullable<WriteBody['dashboard_roles']>[number]
export type KpiDefinitionCreate = WriteBody
export type KpiDefinitionPatch  = Partial<WriteBody>
export type KpiOrderBody        = NonNullable<operations['putKpiDefinitionsOrder']['requestBody']>['content']['application/json']
export type KpiDefinitionsQuery = NonNullable<operations['getKpiDefinitions']['parameters']['query']>

// Hand-written — GET /kpi-metrics has no generated 2xx schema. One entry per
// entity; `dimensions[0]` is always 'all' (the "no breakdown" choice).
export interface KpiMetric {
  key: string
  label: string
  kind: string
  default_unit: KpiUnit
}
export interface KpiEntityRegistry {
  metrics: KpiMetric[]
  dimensions: string[]
}
export type KpiMetricsRegistry = Partial<Record<KpiEntity, KpiEntityRegistry>>

// Hand-written — GET/POST/PATCH /kpi-definitions* have no generated 2xx schema.
// `computed` is server-composed (label/timestamps) and never sent back on a write
// (§10 GET-shape == PUT-shape, `computed` excluded from every write body).
export interface KpiDefinition {
  id: string
  entity: KpiEntity
  metric_key: string
  dimension: string
  dimension_value: string | null
  label: string | null
  target_value: number | null
  warn_value: number | null
  comparison: KpiComparison
  unit: KpiUnit
  surfaces: KpiSurface[]
  dashboard_roles: KpiDashboardRole[] | null
  active: boolean
  sort_order: number
  computed?: {
    metric_label?: string
    created_at?: string
    updated_at?: string
  }
}

// Honest UI caps mirroring the backend's tenant guard (the FE counter is a
// courtesy, never the enforcement — the server still 422s past these).
export const KPI_CAP_PER_ENTITY = 12
export const KPI_CAP_PER_TENANT = 40

// GET /kpi-metrics — the per-entity metric registry driving the form's pickers.
export const fetchKpiMetrics = (signal?: AbortSignal): Promise<KpiMetricsRegistry> =>
  api.get('/kpi-metrics', { signal }).then(res => unwrap<KpiMetricsRegistry>(res) ?? {})

// GET /kpi-definitions?entity=&active= — a tenant's own KPI rows, server-ordered.
export const fetchKpiDefinitions = (params: KpiDefinitionsQuery, signal?: AbortSignal): Promise<KpiDefinition[]> =>
  api.get('/kpi-definitions', { params, signal }).then(res => unwrapList<KpiDefinition>(res).rows)

// POST /kpi-definitions — create a new tenant KPI.
export const createKpiDefinition = (body: KpiDefinitionCreate): Promise<KpiDefinition> =>
  api.post('/kpi-definitions', body).then(res => unwrap<KpiDefinition>(res))

// PATCH /kpi-definitions/{id} — absent field = unchanged (§10); callers send only changed keys.
export const patchKpiDefinition = (id: string, body: KpiDefinitionPatch): Promise<KpiDefinition> =>
  api.patch(`/kpi-definitions/${id}`, body).then(res => unwrap<KpiDefinition>(res))

// DELETE /kpi-definitions/{id} — reversible (update-class permission, never .delete, §5).
export const deleteKpiDefinition = (id: string): Promise<void> =>
  api.delete(`/kpi-definitions/${id}`).then(() => undefined)

// POST /kpi-definitions/{id}/restore — undoes the delete above (session-only undo, R3).
export const restoreKpiDefinition = (id: string): Promise<KpiDefinition> =>
  api.post(`/kpi-definitions/${id}/restore`).then(res => unwrap<KpiDefinition>(res))

// PUT /kpi-definitions/order — persists a drag/keyboard reorder as the full id order.
export const putKpiDefinitionsOrder = (ids: string[]): Promise<void> => {
  const body: KpiOrderBody = { ids }
  return api.put('/kpi-definitions/order', body).then(() => undefined)
}
