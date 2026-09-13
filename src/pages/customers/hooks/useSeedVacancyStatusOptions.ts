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

// The raw `GET /vacancy-statuses` row shape both callers map from — `value`
// falls back through id/value/name (BUG FIX 28-07: the endpoint returns `id`,
// never `value`), and `is_closed` is optional (only VacanciesTab's own default
// guess reads it).
export interface RawVacancyStatusRow {
  id?: string; value?: string; label?: string; name?: string; active?: boolean; is_closed?: boolean
}

/**
 * mapVacancyStatusOptions — the shared `GET /vacancy-statuses` row → filter-
 * option mapping (DRY round, CANDTABS package): active rows only, `value`
 * resolved id-first, empty values dropped. `extra` lets a caller (VacanciesTab)
 * attach its own additional field (`isClosed`) without a second copy of the
 * filter/map/filter chain.
 */
export function mapVacancyStatusOptions<T extends SeedStatus>(
  raw: RawVacancyStatusRow[],
  extra?: (o: RawVacancyStatusRow) => Omit<T, 'value' | 'label'>,
): T[] {
  return raw.filter(o => o.active !== false)
    .map(o => ({
      value: String(o.id ?? o.value ?? o.name ?? ''),
      label: String(o.label ?? o.name ?? ''),
      ...(extra ? extra(o) : {}),
    } as T))
    .filter(o => o.value)
}
