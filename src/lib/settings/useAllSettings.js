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

let cache = null
let fetchStarted = false
const listeners = new Set()

export function useAllSettings() {
  // Initial state already reflects the cache, so no synchronous setState in the effect.
  const [values, setValues] = useState(cache ?? {})

  useEffect(() => {
    const notify = (v) => setValues(v)
    listeners.add(notify)
    if (!fetchStarted) {
      fetchStarted = true
      api.get('/settings')
        .then(res => { cache = res.data ?? {}; listeners.forEach(l => l(cache)) })
        .catch(() => { fetchStarted = false })
    }
    return () => { listeners.delete(notify) }
  }, [])

  return values
}

/** Persist a partial set of keys (merge), update the cache and notify subscribers. */
export async function saveSettingsKeys(partial) {
  const stringified = {}
  Object.entries(partial).forEach(([k, v]) => {
    stringified[k] = typeof v === 'string' ? v : JSON.stringify(v)
  })
  cache = { ...(cache ?? {}), ...stringified }
  listeners.forEach(l => l(cache))
  await api.post('/settings', stringified)
  invalidateKpiCache()
}

/** Read + parse a JSON-encoded setting value, falling back when absent/invalid. */
export function getJsonSetting(values, key, fallback) {
  const raw = values?.[key]
  if (raw == null) return fallback
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return fallback }
}
