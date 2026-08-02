/**
 * useAllSettings — single shared loader for the tenant `/settings` blob.
 *
 * Provider-free (module-level cache + pub/sub) so BOTH the settings editors and
 * the dashboards/reports read the same source without a wrapping context. Mirrors
 * the existing useKpiSettings pattern. Saving a partial merges by key and notifies
 * every subscriber, so a change in settings reflects live on the dashboards.
 */
import { useState, useEffect } from 'react'
import api from '../api'
import { invalidateKpiCache } from '../useKpiSettings'

type SettingsBlob = Record<string, unknown>

let cache: SettingsBlob | null = null
let fetchStarted = false
const listeners = new Set<(v: SettingsBlob) => void>()

export function useAllSettings(): SettingsBlob {
  // Initial state already reflects the cache, so no synchronous setState in the effect.
  const [values, setValues] = useState<SettingsBlob>(cache ?? {})

  useEffect(() => {
    const notify = (v: SettingsBlob) => setValues(v)
    listeners.add(notify)
    if (!fetchStarted) {
      fetchStarted = true
      api.get('/settings')
        .then(res => { const next = (res.data ?? {}) as SettingsBlob; cache = next; listeners.forEach(l => l(next)) })
        .catch(() => { fetchStarted = false })
    }
    return () => { listeners.delete(notify) }
  }, [])

  return values
}

/**
 * Has the shared `/settings` blob resolved at least once THIS session? Distinct from
 * `useAllSettings()`'s own returned values, which start as `{}` before the fetch
 * resolves — a caller that must tell "genuinely absent" apart from "not loaded yet"
 * (e.g. a one-shot default it must never re-decide once already applied, see
 * `useStatusFilter`'s `settingsLoaded` guard) reads this first.
 */
export function useSettingsLoaded(): boolean {
  const [loaded, setLoaded] = useState(cache !== null)

  useEffect(() => {
    if (cache !== null) { setLoaded(true); return }
    const notify = () => setLoaded(true)
    listeners.add(notify)
    return () => { listeners.delete(notify) }
  }, [])

  return loaded
}

/** Persist a partial set of keys (merge), update the cache and notify subscribers. */
export async function saveSettingsKeys(partial: Record<string, unknown>): Promise<void> {
  const stringified: Record<string, string> = {}
  Object.entries(partial).forEach(([k, v]) => {
    stringified[k] = typeof v === 'string' ? v : JSON.stringify(v)
  })
  const merged: SettingsBlob = { ...(cache ?? {}), ...stringified }
  cache = merged
  listeners.forEach(l => l(merged))
  await api.post('/settings', stringified)
  invalidateKpiCache()
}

/**
 * Invalidate the shared cache and refetch, notifying live subscribers. Call this
 * after a save made through another path (e.g. settingsApi) so already-mounted
 * readers (dashboards, the candidate table) pick up the change without a reload.
 */
export function invalidateAllSettingsCache(): void {
  cache = null
  fetchStarted = false
  if (listeners.size === 0) return
  fetchStarted = true
  api.get('/settings')
    .then(res => { const next = (res.data ?? {}) as SettingsBlob; cache = next; listeners.forEach(l => l(next)) })
    .catch(() => { fetchStarted = false })
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
