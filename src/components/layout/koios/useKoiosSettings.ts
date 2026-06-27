/**
 * useKoiosSettings — loads GET /ai/koios/settings the first time the panel opens
 * (selectable models + connection/policy status). Fetched lazily so a closed
 * panel never hits the endpoint, and a 404/403 just leaves settings null (the
 * model picker hides and the status falls back to optimistic).
 */
import { useEffect, useState } from 'react'
import { getKoiosSettings } from './koiosApi'
import type { KoiosSettings } from '../../../types/koios'

export function useKoiosSettings(enabled?: boolean) {
  const [settings, setSettings] = useState<KoiosSettings | null>(null)
  const [loaded, setLoaded]     = useState(false)

  useEffect(() => {
    if (!enabled || loaded) return
    let alive = true
    getKoiosSettings()
      .then((d) => { if (alive) setSettings(d) })
      .catch(() => { /* leave null — picker hidden, status optimistic */ })
      .finally(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [enabled, loaded])

  return { settings }
}
