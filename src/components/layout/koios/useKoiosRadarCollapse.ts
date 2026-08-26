/**
 * useKoiosRadarCollapse — persists whether the "Koios Advies" landing-state card
 * (KoiosRadar) is collapsed (Danny 22-08: "nu te veel ruimte in beslag" — the
 * card must be closable and re-summonable via a small button). Mirrors
 * useKoiosPanelWidth's own localStorage convention exactly (try/catch swallow on
 * quota/private-mode failures) rather than inventing a new persistence
 * mechanism. Default is OPEN — Danny asked for the ABILITY to close it, never a
 * new default, so an absent/corrupt stored value always falls back to open.
 */
import { useCallback, useState } from 'react'

const STORAGE_KEY = 'koios.radar.collapsed'

// Read the persisted collapsed flag; any storage failure (quota, private mode,
// or simply nothing stored yet) degrades to the default (open).
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

// Persisted open/closed toggle for the KoiosRadar card (see the module doc above); read/write both degrade to the default (open) on any storage failure.
export function useKoiosRadarCollapse() {
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed)

  // Persist the new choice; same defensive swallow as every other Koios
  // preference — a failed write just means the choice stays in-memory only.
  const setAndPersist = useCallback((next: boolean) => {
    setCollapsed(next)
    try { localStorage.setItem(STORAGE_KEY, String(next)) } catch { /* quota / private mode — stays in memory */ }
  }, [])

  return { collapsed, setCollapsed: setAndPersist }
}
