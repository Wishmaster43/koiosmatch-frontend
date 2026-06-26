/**
 * useKpiSettings — loads tenant KPI/target settings from /settings (cached) and
 * exposes them to components, falling back to SETTING_DEFAULTS. Also provides
 * invalidateKpiCache() so SettingsPage can force a reload after saving.
 */
import { useState, useEffect } from 'react'
import api from './api'

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

let cache: Record<string, number> | null = null

export function useKpiSettings() {
  const [settings, setSettings] = useState<Record<string, number>>(cache ?? SETTING_DEFAULTS)

  useEffect(() => {
    if (cache) return
    api.get('/settings')
      .then(res => {
        const raw = (res.data ?? {}) as Record<string, unknown>
        const parsed: Record<string, number> = {}
        Object.keys(SETTING_DEFAULTS).forEach(k => {
          parsed[k] = raw[k] !== undefined ? Number(raw[k]) : SETTING_DEFAULTS[k]
        })
        cache = parsed
        setSettings(parsed)
      })
      .catch(() => {})
  }, [])

  return settings
}

// Invalidate the cache after saving so all components pick up the new values.
export function invalidateKpiCache() {
  cache = null
}
