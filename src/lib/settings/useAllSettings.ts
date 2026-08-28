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

// SETTINGS-LOAD-ERROR-1: load state per tenant, exposed via useSettingsLoadState()
// so a consumer can tell "still loading" apart from "the GET actually failed" —
// the plain useAllSettings() blob stays {} in both cases and can't distinguish them.
type LoadState = 'loading' | 'loaded' | 'failed'

// One slot per tenant: the cached blob, whether a fetch is already in flight, the
// load state, and the set of subscribers to notify when that tenant's blob changes.
const cacheByTenant = new Map<string, SettingsBlob>()
const fetchStartedByTenant = new Set<string>()
const listenersByTenant = new Map<string, Set<(v: SettingsBlob) => void>>()
const loadStateByTenant = new Map<string, LoadState>()
const loadStateListenersByTenant = new Map<string, Set<(s: LoadState) => void>>()

// Reads localStorage fresh on every call (never memoized) so it always reflects
// the CURRENT tenant, mirroring useCachedLookup's tenantCacheKey.
const activeTenantKey = (): string => getActiveTenantId() ?? 'none'

// Lazily create (never replace) the listener set for a tenant slot.
function listenersFor(tenantKey: string): Set<(v: SettingsBlob) => void> {
  let set = listenersByTenant.get(tenantKey)
  if (!set) { set = new Set(); listenersByTenant.set(tenantKey, set) }
  return set
}

// Same lazy-set pattern for the load-state listeners.
function loadStateListenersFor(tenantKey: string): Set<(s: LoadState) => void> {
  let set = loadStateListenersByTenant.get(tenantKey)
  if (!set) { set = new Set(); loadStateListenersByTenant.set(tenantKey, set) }
  return set
}

// Sets a tenant's load state and notifies its load-state subscribers.
function setLoadState(tenantKey: string, state: LoadState): void {
  loadStateByTenant.set(tenantKey, state)
  loadStateListenersFor(tenantKey).forEach(l => l(state))
}

// Shared fetch: the actual GET /settings, updating both the blob cache and the
// load state, used by the initial load, useSettingsLoadState's retry, and any
// future re-fetch path. Kept here so the two call sites can't drift.
function fetchSettings(tenantKey: string): void {
  fetchStartedByTenant.add(tenantKey)
  setLoadState(tenantKey, 'loading')
  api.get('/settings')
    .then(res => {
      const next = (res.data ?? {}) as SettingsBlob
      cacheByTenant.set(tenantKey, next)
      setLoadState(tenantKey, 'loaded')
      listenersFor(tenantKey).forEach(l => l(next))
    })
    .catch(() => {
      fetchStartedByTenant.delete(tenantKey)
      setLoadState(tenantKey, 'failed')
    })
}

export function useAllSettings(): SettingsBlob {
  // Initial state already reflects THIS tenant's cache, so no synchronous setState in the effect.
  const [values, setValues] = useState<SettingsBlob>(cacheByTenant.get(activeTenantKey()) ?? {})

  // Subscribe to this tenant's settings slot and kick off the shared fetch only once per tenant (module-level dedupe across every subscriber).
  useEffect(() => {
    const key = activeTenantKey()
    const notify = (v: SettingsBlob) => setValues(v)
    const listeners = listenersFor(key)
    listeners.add(notify)
    if (!fetchStartedByTenant.has(key)) fetchSettings(key)
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

  // Subscribe to this tenant's slot just to learn WHEN it first resolves; an already-cached tenant resolves synchronously above.
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

/**
 * SETTINGS-LOAD-ERROR-1: the ACTIVE tenant's `/settings` load state —
 * 'loading' | 'loaded' | 'failed' — distinct from useSettingsLoaded()'s plain
 * boolean, so a gating consumer can render a real error state (with retry)
 * instead of silently treating a failed GET as "still empty". `retry()` clears
 * the tenant's fetch-started flag and re-issues the GET, notifying listeners
 * on both this hook and useAllSettings()/useSettingsLoaded() when it resolves.
 */
export function useSettingsLoadState(): { state: LoadState; retry: () => void } {
  const [state, setState] = useState<LoadState>(loadStateByTenant.get(activeTenantKey()) ?? 'loading')

  // Subscribe to this tenant's load-state slot; an in-flight/failed/loaded state
  // already recorded resolves synchronously above, this effect just keeps it live.
  useEffect(() => {
    const key = activeTenantKey()
    const current = loadStateByTenant.get(key)
    if (current) setState(current)
    const notify = (s: LoadState) => setState(s)
    const listeners = loadStateListenersFor(key)
    listeners.add(notify)
    if (!fetchStartedByTenant.has(key) && !current) fetchSettings(key)
    return () => { listeners.delete(notify) }
  }, [])

  // Re-issues the GET for the active tenant, clearing the in-flight flag first
  // so a stuck 'failed' state can actually retry (mirrors invalidateAllSettingsCache).
  const retry = () => {
    const key = activeTenantKey()
    fetchStartedByTenant.delete(key)
    fetchSettings(key)
  }

  return { state, retry }
}

/** Persist a partial set of keys (merge), update the ACTIVE tenant's cache slot and notify its subscribers.
 * Optimistic: the cache updates before the POST, but a rejected save REVERTS the
 * slot and renotifies before rethrowing — a refused write must never keep
 * rendering as saved (mega-audit r2). */
export async function saveSettingsKeys(partial: Record<string, unknown>): Promise<void> {
  const stringified: Record<string, string> = {}
  Object.entries(partial).forEach(([k, v]) => {
    stringified[k] = typeof v === 'string' ? v : JSON.stringify(v)
  })
  const key = activeTenantKey()
  const previous = cacheByTenant.get(key)
  const merged: SettingsBlob = { ...(previous ?? {}), ...stringified }
  cacheByTenant.set(key, merged)
  listenersFor(key).forEach(l => l(merged))
  try {
    await api.post('/settings', stringified)
  } catch (err) {
    if (previous) cacheByTenant.set(key, previous)
    else cacheByTenant.delete(key)
    const reverted = cacheByTenant.get(key) ?? {}
    listenersFor(key).forEach(l => l(reverted))
    throw err
  }
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
  fetchSettings(key)
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
