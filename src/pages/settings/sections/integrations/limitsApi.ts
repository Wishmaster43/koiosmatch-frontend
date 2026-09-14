/**
 * limitsApi — typed client for the usage & limits endpoints
 * GET /settings/integrations/limits (tenant) + GET /admin/limits (super-admin).
 */
import api from '@/lib/api'
import type { BillingUsageTierMeterBase, BillingTierRef } from '@/types/billingTiers'
import type { operations } from '@/types/api-generated'

// DRAFT-LIMIET-BEHEER-1 §2 point 3 — the three behaviours a connector can have at its cap.
export type LimitMode = 'signal' | 'queue' | 'block'

// An active approval on a tenant connector row (§3, POST/DELETE approvals). Price
// fields are omitted server-side unless the caller holds billing.view (§3 GET note).
export interface LimitApproval {
  id: string
  until: string | null
  extra_cap: number | null
  surcharge_cents?: number | null
  note?: string | null
  approved_by_name?: string | null
}

// A single limit meter row from the tenant endpoint. mode/cap_source/settable/
// can_request/approval land with LIMITS-BEHEER-1 (contract §3 GET /settings/integrations/limits).
export interface TenantLimitRow {
  key: string
  label: string
  scope: 'tenant'
  window: 'hour' | 'day' | 'week' | 'month'
  used: number
  cap: number | null
  percent: number | null
  cap_reached: boolean
  mode?: LimitMode | null
  mode_effective?: LimitMode | null
  mode_fixed?: boolean
  cap_source?: string | null
  settable?: boolean
  can_request?: boolean
  approval?: LimitApproval | null
  // billing.view only: the FULL tier meter for this unit (same block GET /billing/usage
  // exposes) — the chosen tier sits in `tier.tier`, the package baseline in `tier.baseline_tier`.
  prices?: { tier: BillingTierRef | (BillingUsageTierMeterBase & { baseline_tier?: BillingTierRef | null }) }
}

// A platform limit row from the super-admin endpoint. mode/cap_source/settable are
// hand-added ahead of the generated spec (api-generated.ts's getAdminLimits response
// still lags the contract doc §3 at time of writing) — optional so an older payload
// still renders; AdminLimitsTable falls back to a safe default when they are absent.
export interface PlatformLimitRow {
  key: string
  label: string
  scope: 'platform'
  window: 'hour' | 'day' | 'week' | 'month'
  used: number
  cap: number | null
  percent: number | null
  cap_reached: boolean
  source: string
  enforced: boolean
  mode?: LimitMode | null
  mode_effective?: LimitMode | null
  // opencage/geocode_search carry mode_fixed:true (contract §2 point 2) — their mode
  // can never be changed to anything but block, so the editor must render it read-only.
  mode_fixed?: boolean
  cap_source?: string | null
  settable?: boolean
}

// A tenant's full connector row from the super-admin drawer (GET /admin/tenants/{tenant}/limits).
export interface AdminTenantLimitRow {
  connector: string
  label: string
  window: 'hour' | 'day' | 'week' | 'month'
  used: number
  cap: number | null
  cap_source: string
  // EffectiveLimit::for() returns ?mode/?percent — a row with no stored mode/cap
  // serves null, not a default, so the type must not lie about that (§ verifier fix).
  mode: LimitMode | null
  mode_effective: LimitMode | null
  mode_fixed: boolean
  percent: number | null
  cap_reached: boolean
  approval: LimitApproval | null
  tenant_settable: boolean
}

// A tenant-near-cap entry from the super-admin endpoint.
export interface TenantNearCapEntry {
  tenant_id: string
  tenant_name: string
  connector?: string
  percent?: number
  cap_reached?: boolean
  // Backend may respond with the old flat shape; tolerance for both
  rows?: Array<{
    key: string
    label: string
    percent: number | null
    cap_reached: boolean
  }>
}

// Super-admin platform limits response shape (inside the .data wrapper).
export interface AdminLimitsData {
  platform: PlatformLimitRow[]
  tenants_near_cap: TenantNearCapEntry[]
  skipped_tenants: {
    count: number
    ids: string[]
  }
}

// GET /settings/integrations/limits — fetch tenant limits.
export async function getTenantLimits(): Promise<TenantLimitRow[]> {
  const response = await api.get<{ data: TenantLimitRow[] }>('/settings/integrations/limits')
  return response.data.data
}

// GET /admin/limits — fetch platform limits + tenants near cap (super-admin only).
export async function getPlatformLimits(): Promise<AdminLimitsData> {
  const response = await api.get<{ data: AdminLimitsData }>('/admin/limits')
  return response.data.data
}

// One row of a limits PUT body (contract §3, hand-written: the generated spec
// infers the `limits` array element as a bare `string` from its doc example).
// mode: null is a valid PUT body (UpdateTenantLimitsRequest allows it = inherit platform).
export interface LimitPutRow { connector: string; cap: number | null; mode: LimitMode | null }

// PUT /admin/limits — set the platform default cap/mode per connector; 200 with the GET shape.
export async function putPlatformLimits(limits: LimitPutRow[]): Promise<AdminLimitsData> {
  const response = await api.put<{ data: AdminLimitsData }>('/admin/limits', { limits })
  return response.data.data
}

// GET /admin/tenants/{tenant}/limits — one tenant's settable connectors (super-admin drawer).
export async function getAdminTenantLimits(tenantId: string): Promise<AdminTenantLimitRow[]> {
  const response = await api.get<{ data: AdminTenantLimitRow[] }>(`/admin/tenants/${tenantId}/limits`)
  return response.data.data
}

// PUT /admin/tenants/{tenant}/limits — cap:null inherits the platform default.
export async function putAdminTenantLimits(tenantId: string, limits: LimitPutRow[]): Promise<AdminTenantLimitRow[]> {
  const response = await api.put<{ data: AdminTenantLimitRow[] }>(`/admin/tenants/${tenantId}/limits`, { limits })
  return response.data.data
}

// Body for granting an approval (§3 POST approvals) — typed straight from the
// generated spec, which carries this shape exactly (until/extra_cap/surcharge_cents/note).
export type ApprovalRequestBody = NonNullable<operations['postAdminTenantsTenantLimitsConnectorApprovals']['requestBody']>['content']['application/json']

// POST /admin/tenants/{tenant}/limits/{connector}/approvals — grant an approval, 201.
export async function postApproval(tenantId: string, connector: string, body: ApprovalRequestBody): Promise<LimitApproval> {
  const response = await api.post<{ data: LimitApproval }>(`/admin/tenants/${tenantId}/limits/${connector}/approvals`, body)
  return response.data.data
}

// DELETE /admin/tenants/{tenant}/limits/{connector}/approvals/{id} — revoke, 204.
export async function deleteApproval(tenantId: string, connector: string, id: string): Promise<void> {
  await api.delete(`/admin/tenants/${tenantId}/limits/${connector}/approvals/${id}`)
}

// The 202 body's `status` union (contract: requested vs already_requested_today vs
// no_recipient are distinct outcomes the FE must not collapse into one "requested" state).
export type LimitRequestStatus = 'requested' | 'already_requested_today' | 'no_recipient'
type LimitRequestBody = NonNullable<operations['postSettingsIntegrationsLimitsConnectorRequest']['requestBody']>['content']['application/json']

// POST /settings/integrations/limits/{connector}/request — tenant admin asks for more, 202.
export async function postLimitRequest(connector: string, note?: LimitRequestBody['note']): Promise<{ status: LimitRequestStatus }> {
  const response = await api.post<{ status: LimitRequestStatus }>(`/settings/integrations/limits/${connector}/request`, { note: note || undefined })
  return response.data
}
