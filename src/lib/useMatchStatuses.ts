/**
 * useMatchStatuses — tenant-configurable match lifecycle statuses (R-1b).
 *
 * Fed by GET /match-statuses ({value,label,color,is_closed}); seed fallback
 * mirrors the backend seed. The is_closed FLAG (never the slug) drives the
 * behaviour: a closed status ends the match (ended_at + out of the open count).
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { unwrapList } from '@/lib/api'

// Index signature added (TAKEN-TOOLBAR-2/MATCHES-TOOLBAR-1): lets this list feed
// straight into the shared StatusFilterSelect/useStatusFilter, which takes
// LookupOption[] — a structural-typing requirement only, no runtime change.
export interface MatchStatus { value: string; label: string; color?: string; is_closed: boolean; [k: string]: unknown }

/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
export const DEFAULT_MATCH_STATUSES: MatchStatus[] = [
  // M30 (Danny 05-08): label "Actief" — "Open" read as a to-do state; the slug stays
  // `open` (the stable machine key the BE core keys off, labels are tenant-editable).
  { value: 'open',   label: 'Actief',     color: '#6FA8C4', is_closed: false },
  { value: 'closed', label: 'Afgesloten', color: '#79B58E', is_closed: true },
]
/* eslint-enable no-restricted-syntax */

// Normalise an API row to the UI shape (value/label tolerant, flag coerced).
const toStatus = (r: Record<string, unknown>): MatchStatus => ({
  value: String(r.value ?? r.slug ?? r.name ?? r.id ?? ''),
  label: String(r.name ?? r.label ?? r.value ?? ''),
  color: (r.color as string) ?? undefined,
  is_closed: Boolean(r.is_closed),
})

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapMatchStatuses = (res: AxiosResponse): MatchStatus[] | null => {
  const rows = (unwrapList(res).rows) as Record<string, unknown>[]
  return Array.isArray(rows) && rows.length ? rows.map(toStatus) : null
}

export function useMatchStatuses() {
  const { t } = useTranslation('matches')
  // The endpoint now exists (item 11) — a real 404 should surface in the dev log again.
  const { data: rawStatuses } = useCachedLookup('/match-statuses', mapMatchStatuses, DEFAULT_MATCH_STATUSES)
  // Translate labels only while still on the SEED fallback (reference-equal to the
  // DEFAULT_MATCH_STATUSES const) — real tenant-configured API labels pass through
  // untouched; the literal Dutch seed text is the defaultValue.
  const statuses = rawStatuses === DEFAULT_MATCH_STATUSES
    ? rawStatuses.map(s => ({ ...s, label: t(`lookupSeeds.statuses.${s.value}`, { defaultValue: s.label }) }))
    : rawStatuses

  // Resolve a stored slug to its meta; tolerant of label-stored values.
  // useCallback: consumers hang this in memo/effect deps — it must be stable.
  const metaOf = useCallback((v?: string | null): MatchStatus | undefined =>
    statuses.find(s => s.value === v || s.label === v), [statuses])

  return { statuses, metaOf }
}
