/**
 * useSeedVacancyStatusOptions — the seeded-until-resolved vacancy-status state
 * shared by ScopedVacanciesTab and VacanciesTab (DRY round 11, CUSTTABS2). The
 * SEED_STATUSES list itself stays local to each caller (VacanciesTab's seed
 * carries an extra `isClosed` flag its default-status guess needs,
 * ScopedVacanciesTab's does not — rule B: the shared unit takes the
 * difference, never bakes one copy's shape into the other), generic over
 * whatever extra fields the caller's own seed entries carry.
 */
import { useState } from 'react'
import type { TFunction } from 'i18next'

interface SeedStatus { value: string; label: string }

// Translate every seed label in the LAZY state initialiser (per-value key, Dutch
// literal as fallback) so a failed/empty lookup never leaves a Dutch island in the
// status filter, and the map runs once instead of on every render.
export function useSeedVacancyStatusOptions<T extends SeedStatus>(t: TFunction, seedStatuses: T[]) {
  const [statusOptions, setStatusOptions] = useState<T[]>(() =>
    seedStatuses.map(s => ({ ...s, label: t(`lookupSeeds.vacancyStatuses.${s.value}`, { defaultValue: s.label }) })))
  // Has the REAL lookup answered? The seed list must never decide the default
  // selection (uuid vs seed-slug mismatch — see VacanciesTab's own BUG FIX note).
  const [resolved, setResolved] = useState(false)

  return { statusOptions, setStatusOptions, resolved, setResolved }
}
