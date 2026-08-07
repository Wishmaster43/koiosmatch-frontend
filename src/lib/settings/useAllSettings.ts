/**
 * useAllSettings — single shared loader for the tenant `/settings` blob.
 *
 * Provider-free (module-level cache + pub/sub) so BOTH the settings editors and
 * the dashboards/reports read the same source without a wrapping context. Mirrors
 * the existing useKpiSettings pattern. Saving a partial merges by key and notifies
 * every subscriber, so a change in settings reflects live on the dashboards.
 *
 * TENANT SCOPING: cache/fetch-state/listeners are all keyed by `${tenantId}`
 * (mirrors useCachedLookup's tenantCacheKey), not module-level singletons — a
 * super-admin switching bureaus mid-session must never be served the PREVIOUS
 * tenant's settings blob, and a save/invalidate must only notify THAT tenant's
 * subscribers. Each tenant keeps its own pub/sub set, so the notify mechanism
 * itself is untouched — it just operates per-slot instead of globally.
 */
import { useState, useEffect } from 'react'
import api, { getActiveTenantId } from '../api'
import { invalidateKpiCache } from '../useKpiSettings'

type SettingsBlob = Record<string, unknown>

// One slot per tenant: the cached blob, whether a fetch is already in flight, and
// the set of subscribers to notify when that tenant's blob changes.
const cacheByTenant = new Map<string, SettingsBlob>()
const fetchStartedByTenant = new Set<string>()
const listenersByTenant = new Map<string, Set<(v: SettingsBlob) => void>>()

// Reads localStorage fresh on every call (never memoized) so it always reflects
// the CURRENT tenant, mirroring useCachedLookup's tenantCacheKey.
const activeTenantKey = (): string => getActiveTenantId() ?? 'none'

// Lazily create (never replace) the listener set for a tenant slot.
function listenersFor(tenantKey: string): Set<(v: SettingsBlob) => void> {
  let set = listenersByTenant.get(tenantKey)
  if (!set) { set = new Set(); listenersByTenant.set(tenantKey, set) }
  return set
}

export function useAllSettings(): SettingsBlob {
  // Initial state already reflects THIS tenant's cache, so no synchronous setState in the effect.
  const [values, setValues] = useState<SettingsBlob>(cacheByTenant.get(activeTenantKey()) ?? {})

  useEffect(() => {
    const key = activeTenantKey()
    const notify = (v: SettingsBlob) => setValues(v)
    const listeners = listenersFor(key)
    listeners.add(notify)
    if (!fetchStartedByTenant.has(key)) {
      fetchStartedByTenant.add(key)
      api.get('/settings')
        .then(res => {
          const next = (res.data ?? {}) as SettingsBlob
          cacheByTenant.set(key, next)
          listenersFor(key).forEach(l => l(next))
        })
        .catch(() => { fetchStartedByTenant.delete(key) })
    }
    return () => { listeners.delete(notify) }
  }, [])

  return values
}

/**
 * Has the shared `/settings` blob resolved at least once THIS session for the
 * ACTIVE tenant? Distinct from `useAllSettings()`'s own returned values, which
 * start as `{}` before the fetch resolves — a caller that must tell "genuinely
 * absent" apart from "not loaded yet" (e.g. a one-shot default it must never
 * re-decide once already applied, see `useStatusFilter`'s `settingsLoaded` guard)
 * reads this first.
 */
export function useSettingsLoaded(): boolean {
  const [loaded, setLoaded] = useState(cacheByTenant.has(activeTenantKey()))

  useEffect(() => {
    const key = activeTenantKey()
    if (cacheByTenant.has(key)) { setLoaded(true); return }
    const notify = () => setLoaded(true)
    const listeners = listenersFor(key)
    listeners.add(notify)
    return () => { listeners.delete(notify) }
  }, [])

  return loaded
}

/** Persist a partial set of keys (merge), update the ACTIVE tenant's cache slot and notify its subscribers. */
export async function saveSettingsKeys(partial: Record<string, unknown>): Promise<void> {
  const stringified: Record<string, string> = {}
  Object.entries(partial).forEach(([k, v]) => {
    stringified[k] = typeof v === 'string' ? v : JSON.stringify(v)
  })
  const key = activeTenantKey()
  const merged: SettingsBlob = { ...(cacheByTenant.get(key) ?? {}), ...stringified }
  cacheByTenant.set(key, merged)
  listenersFor(key).forEach(l => l(merged))
  await api.post('/settings', stringified)
  invalidateKpiCache()
}

/**
 * Invalidate the ACTIVE tenant's cache slot and refetch, notifying its live
 * subscribers. Call this after a save made through another path (e.g. settingsApi)
 * so already-mounted readers (dashboards, the candidate table) pick up the change
 * without a reload. Other tenants' slots are untouched.
 */
export function invalidateAllSettingsCache(): void {
  const key = activeTenantKey()
  cacheByTenant.delete(key)
  fetchStartedByTenant.delete(key)
  const listeners = listenersByTenant.get(key)
  if (!listeners || listeners.size === 0) return
  fetchStartedByTenant.add(key)
  api.get('/settings')
    .then(res => {
      const next = (res.data ?? {}) as SettingsBlob
      cacheByTenant.set(key, next)
      listeners.forEach(l => l(next))
    })
    .catch(() => { fetchStartedByTenant.delete(key) })
}

/**
 * Read a boolean setting EXACTLY like the settings form coerces it (`true`/`'true'`),
 * so a toggle and the screens that read it never disagree. A stored `1`/`'1'`/other
 * truthy-but-not-"true" value reads as false here too — matching the toggle's "off".
 */
export function getBoolSetting(values: SettingsBlob | null | undefined, key: string, fallback: boolean): boolean {
  const raw = values?.[key]
  if (raw == null) return fallback
  return raw === true || raw === 'true'
}

/** Read + parse a JSON-encoded setting value, falling back when absent/invalid. */
export function getJsonSetting<T>(values: SettingsBlob | null | undefined, key: string, fallback: T): T {
  const raw = values?.[key]
  if (raw == null) return fallback
  try { return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T } catch { return fallback }
}

/** Read a numeric setting (coerced from a stored string/number), falling back when absent/invalid. */
export function getNumberSetting(values: SettingsBlob | null | undefined, key: string, fallback: number): number {
  const raw = values?.[key]
  if (raw == null) return fallback
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Read a plain string setting as-is (e.g. a tenant-picked lookup id/sentinel), falling back
 * only when the key is truly absent — an empty string is a legitimate stored value and must
 * not collapse to the fallback (mirrors getBoolSetting/getNumberSetting's absent-only rule).
 */
export function getStringSetting(values: SettingsBlob | null | undefined, key: string, fallback: string | null = null): string | null {
  const raw = values?.[key]
  if (raw == null) return fallback
  return typeof raw === 'string' ? raw : String(raw)
}
