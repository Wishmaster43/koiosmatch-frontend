/**
 * useNumberingEntities — reads the numbering entity list from the backend
 * (NUMBERING-LOOKUP-1, GET /numbering-entities) instead of a hardcoded six-entity
 * array. The backend's config/numbering.php defines TWELVE entities (candidate,
 * customer, vacancy, customer_location, customer_department, match, application,
 * task, opportunity, outreach_campaign, customer_contact, location) — the old FE
 * array only knew the first six, so the six added later (NUMMER-2) never reached
 * Settings → Nummering (CMBE 04-08 finding: "Nummering telt TWAALF entiteiten,
 * niet zes"). Platform data, not tenant-configurable (open read, no write path) —
 * cached for the session via useCachedLookup, same convention as useProvinces.
 *
 * `label` is the backend's own Dutch display name (a display-only fallback, never
 * used for logic). The consuming component resolves the KEY through
 * `t('numbering.entities.<key>', { defaultValue: label })` (mirrors ModulePicker's
 * `t(key, { defaultValue })` convention) so a translated key wins once it lands in
 * every locale, without ever showing a raw i18n key for an entity that has none yet.
 */
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from '@/lib/useCachedLookup'
import { unwrapList } from '@/lib/api'

export interface NumberingEntity {
  key: string
  prefix: string
  pad: number
  start: number
  label: string
}

// The pre-endpoint six-entity seed — the offline/loading fallback so the screen
// never regresses to blank while the first fetch is in flight. Values mirror the
// old hardcoded ENTITIES array (and config/numbering.php's own defaults for them).
const FALLBACK: NumberingEntity[] = [
  { key: 'candidate',           prefix: 'K', pad: 5, start: 1, label: 'Kandidaat' },
  { key: 'customer',            prefix: 'D', pad: 5, start: 1, label: 'Klant' },
  { key: 'vacancy',             prefix: 'V', pad: 5, start: 1, label: 'Vacature' },
  { key: 'customer_location',   prefix: 'L', pad: 3, start: 1, label: 'Locatie' },
  { key: 'customer_department', prefix: 'A', pad: 3, start: 1, label: 'Afdeling' },
  { key: 'match',               prefix: 'M', pad: 5, start: 1, label: 'Match' },
]

// Parse {data:[{key,prefix,pad,start,label}]}. This endpoint is never legitimately
// empty (it mirrors a non-empty backend config file) — an empty response means
// "nothing usable", so useCachedLookup keeps the fallback and retries next mount.
function mapEntities(res: AxiosResponse): NumberingEntity[] | null {
  const raw = unwrapList(res).rows as Array<Record<string, unknown>>
  if (!raw.length) return null
  const rows = raw
    .map(row => ({
      key: String(row.key ?? ''),
      prefix: String(row.prefix ?? ''),
      pad: Number(row.pad) || 1,
      start: Number(row.start) || 1,
      label: String(row.label ?? row.key ?? ''),
    }))
    .filter(e => e.key)
  return rows.length ? rows : null
}

export function useNumberingEntities() {
  const { t } = useTranslation('settings')
  const { data: rawEntities, loading } = useCachedLookup('/numbering-entities', mapEntities, FALLBACK)
  // Translate labels only while still on the pre-endpoint SEED fallback (reference-
  // equal to FALLBACK) — the backend's own label already resolves through the SAME
  // key in the consumer (NumberingSettings.jsx), so this only removes the raw Dutch
  // literal from this hook's own return value, never double-translates real data.
  const entities = rawEntities === FALLBACK
    ? rawEntities.map(e => ({ ...e, label: t(`numbering.entities.${e.key}`, { defaultValue: e.label }) }))
    : rawEntities
  return { entities, loading }
}
