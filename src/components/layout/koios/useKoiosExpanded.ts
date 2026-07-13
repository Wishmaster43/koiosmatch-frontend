/**
 * useKoiosExpanded — persists the Koios panel's expand/collapse choice in
 * localStorage (a non-PII UI preference) so the wider chat panel survives
 * reloads, mirroring the entity drawer's expand toggle (§3A EntityDrawer).
 */
import { useCallback, useState } from 'react'

const STORAGE_KEY = 'koios.expanded'

// Read the persisted flag (tolerant of corrupt/absent/private-mode storage).
function readExpanded(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
}

export function useKoiosExpanded() {
  const [expanded, setExpanded] = useState<boolean>(readExpanded)

  // Flip the flag and persist it in the same step.
  const toggle = useCallback(() => {
    setExpanded(prev => {
      const next = !prev
      try { localStorage.setItem(STORAGE_KEY, String(next)) } catch { /* quota / private mode — stays in memory */ }
      return next
    })
  }, [])

  return { expanded, toggle }
}
