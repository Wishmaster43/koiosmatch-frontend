/**
 * useKoiosSettings — loads GET /ai/koios/settings the first time the panel opens
 * (selectable models + connection/policy status). Fetched lazily so a closed
 * panel never hits the endpoint, and a 404/403 just leaves settings null (the
 * model picker hides and the status falls back to optimistic).
 *
 * KOIOS-DEFAULT-SYNC-1 (Danny 23-08: "de standaard hier moet matchen met de
 * instellingen!!" — "the default here must match the settings!!"): the panel
 * used to keep a once-per-session snapshot, so a
 * default flavour changed in Settings → Koios AI never reached the picker. A
 * tiny module-level bus lets any surface that changes the tenant's Koios
 * defaults call `invalidateKoiosSettings()`; every mounted hook then refetches.
 * (A bus rather than the query cache on purpose: the panel is rendered in
 * trees without a QueryClientProvider in several test harnesses.)
 */
import { useEffect, useState } from 'react'
import { getKoiosSettings } from './koiosApi'
import type { KoiosSettings } from '@/types/koios'

const listeners = new Set<() => void>()

// Called by every surface that changes the tenant's Koios defaults (model card,
// effort setting) so an open panel re-reads them.
export const invalidateKoiosSettings = () => { listeners.forEach(fn => fn()) }

export function useKoiosSettings(enabled?: boolean) {
  const [settings, setSettings] = useState<KoiosSettings | null>(null)
  const [loaded, setLoaded]     = useState(false)
  // Epoch bumps on every invalidation → the load effect runs again.
  const [epoch, setEpoch]       = useState(0)

  useEffect(() => {
    const fn = () => { setLoaded(false); setEpoch(e => e + 1) }
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  }, [])

  useEffect(() => {
    if (!enabled || loaded) return
    let alive = true
    getKoiosSettings()
      .then((d) => { if (alive) setSettings(d) })
      .catch(() => { /* leave null — picker hidden, status optimistic */ })
      .finally(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [enabled, loaded, epoch])

  return { settings }
}
