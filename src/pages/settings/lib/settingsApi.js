/**
 * settingsApi — shared GET/POST /settings helpers used by every settings section.
 * POST merges by key on the backend; values are stringified for storage.
 */
import api from '@/lib/api'
import { invalidateKpiCache } from '@/lib/useKpiSettings'
import { invalidateAllSettingsCache } from '@/lib/settings/useAllSettings'

// Fetches the full flat settings bag for the tenant.
export async function loadSettings() {
  const res = await api.get('/settings')
  return res.data ?? {}
}

// Stringifies every value (the backend stores settings as strings) and merges the payload in, then invalidates the shared KPI/all-settings caches so live readers pick up the change.
export async function saveSettings(payload) {
  const stringified = {}
  Object.entries(payload).forEach(([k, v]) => (stringified[k] = String(v)))
  await api.post('/settings', stringified)
  // Refresh both shared caches so live readers (dashboards, candidate table) update.
  invalidateKpiCache()
  invalidateAllSettingsCache()
}
