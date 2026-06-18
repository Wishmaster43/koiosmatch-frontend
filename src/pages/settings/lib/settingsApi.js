/**
 * settingsApi — shared GET/POST /settings helpers used by every settings section.
 * POST merges by key on the backend; values are stringified for storage.
 */
import api from '../../../lib/api'
import { invalidateKpiCache } from '../../../lib/useKpiSettings'

export async function loadSettings() {
  const res = await api.get('/settings')
  return res.data ?? {}
}

export async function saveSettings(payload) {
  const stringified = {}
  Object.entries(payload).forEach(([k, v]) => (stringified[k] = String(v)))
  await api.post('/settings', stringified)
  invalidateKpiCache()
}
