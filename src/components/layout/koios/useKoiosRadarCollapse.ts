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

const RADAR_KEY = 'koios.radar.collapsed'

// Read the persisted collapsed flag; any storage failure (quota, private mode,
// or simply nothing stored yet) degrades to the default (open).
function readCollapsed(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) === 'true'
  } catch {
    return false
  }
}

// Persisted open/closed toggle for a landing-state card (see the module doc
// above); parameterised by storage key so the assistant block shares the ONE
// mechanism instead of a copy (§11) — read/write degrade to open on failure.
export function useKoiosRadarCollapse(storageKey: string = RADAR_KEY) {
  const [collapsed, setCollapsed] = useState<boolean>(() => readCollapsed(storageKey))

  // Persist the new choice; same defensive swallow as every other Koios
  // preference — a failed write just means the choice stays in-memory only.
  const setAndPersist = useCallback((next: boolean) => {
    setCollapsed(next)
    try { localStorage.setItem(storageKey, String(next)) } catch { /* quota / private mode — stays in memory */ }
  }, [storageKey])

  return { collapsed, setCollapsed: setAndPersist }
}
