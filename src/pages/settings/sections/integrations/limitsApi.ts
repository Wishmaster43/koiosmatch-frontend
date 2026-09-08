/**
 * limitsApi — typed client for the usage & limits endpoints
 * GET /settings/integrations/limits (tenant) + GET /admin/limits (super-admin).
 */
import api from '@/lib/api'

// A single limit meter row from the tenant endpoint.
export interface TenantLimitRow {
  key: string
  label: string
  scope: 'tenant'
  window: 'hour' | 'day' | 'week' | 'month'
  used: number
  cap: number | null
  percent: number | null
  cap_reached: boolean
  prices?: {
    tier: {
      key: string
      label: string
      monthly_tokens: number
      price_cents: number
      effective_from: string
      source: string
    }
  }
}

// A platform limit row from the super-admin endpoint.
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
