/**
 * useKpiSettings — loads tenant KPI/target settings from /settings (cached) and
 * exposes them to components, falling back to SETTING_DEFAULTS. Also provides
 * invalidateKpiCache() so SettingsPage can force a reload after saving.
 *
 * TENANT SCOPING: the cache is a Map keyed by `${tenantId}` (mirrors useCachedLookup's
 * tenantCacheKey), not a single module-level blob — a super-admin switching bureaus
 * mid-session must never be served the PREVIOUS tenant's KPI targets from here.
 */
import { useState, useEffect } from 'react'
import api, { getActiveTenantId } from './api'

export const SETTING_DEFAULTS: Record<string, number> = {
  // KPI targets
  new_candidates_target:   15,
  churn_warning_threshold: 10,
  avg_candidates_window:   12,
  occupancy_target:        85,
  response_rate_target:    80,
  // Weergave
  candidates_per_page:     500,
  top_cities_n:            10,
  shifts_detail_limit:     500,
  activity_log_limit:      200,
}

// One cache slot per tenant.
const cacheByTenant = new Map<string, Record<string, number>>()

// Reads localStorage fresh on every call (never memoized) so it always reflects
// the CURRENT tenant, mirroring useCachedLookup's tenantCacheKey.
const activeTenantKey = (): string => getActiveTenantId() ?? 'none'

export function useKpiSettings() {
  const [settings, setSettings] = useState<Record<string, number>>(
    cacheByTenant.get(activeTenantKey()) ?? SETTING_DEFAULTS,
  )

  useEffect(() => {
    const key = activeTenantKey()
    if (cacheByTenant.has(key)) return
    api.get('/settings')
      .then(res => {
        const raw = (res.data ?? {}) as Record<string, unknown>
        const parsed: Record<string, number> = {}
        Object.keys(SETTING_DEFAULTS).forEach(k => {
          parsed[k] = raw[k] !== undefined ? Number(raw[k]) : SETTING_DEFAULTS[k]
        })
        cacheByTenant.set(key, parsed)
        setSettings(parsed)
      })
      .catch(() => {})
  }, [])

  return settings
}

// Invalidate the ACTIVE tenant's cache slot only, so all components mounted for
// that tenant pick up the new values on their next fetch — other tenants' cached
// settings stay untouched.
export function invalidateKpiCache() {
  cacheByTenant.delete(activeTenantKey())
}
