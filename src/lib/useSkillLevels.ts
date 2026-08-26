/**
 * useSkillLevels — tenant-configurable skill proficiency levels, mirroring the
 * language-levels lookup so the skill "niveau" is a dropdown (not free text).
 * Fed by GET /skill-levels once the backend + Settings section land (SKILL-LVL-1);
 * a seed fallback drives the dropdown until then.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 *
 * LOOKUP-ICON-1 (batch 12, P22-30): the backend now carries an optional `icon`
 * (+ `color`) per row, same convention as the other eight lookups in this wave.
 * This hook used to collapse rows to plain strings, which dropped the icon on
 * the floor before any consumer could render it — it now returns full
 * `{ value, label, icon, color }` objects, mirroring useDriverLicenses.
 * BACKWARD COMPAT: `names` still exposes the old plain-string list, so any
 * call-site that only needs label text (e.g. a bare CreatableSelect `options`
 * prop expecting strings) keeps working without touching it.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { translateSeedList } from './lookupSeedI18n'
import { unwrapList } from '@/lib/api'

export interface SkillLevelItem {
  value: string
  label: string
  icon?: string | null
  color?: string | null
}

const SEED_NAMES = ['Basis', 'Gevorderd', 'Expert']
// Kept for any consumer still importing the old plain-string constant.
export const DEFAULT_SKILL_LEVELS = SEED_NAMES
export const DEFAULT_SKILL_LEVEL_ITEMS: SkillLevelItem[] = SEED_NAMES.map(name => ({ value: name, label: name, icon: null, color: null }))

type Named = { name?: string; label?: string; value?: string; icon?: string; color?: string }

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapSkillLevels = (res: AxiosResponse): SkillLevelItem[] | null => {
  const raw = (unwrapList(res).rows) as unknown[]
  const items = raw
    .map((x): SkillLevelItem | null => {
      if (typeof x === 'string') return x ? { value: x, label: x, icon: null, color: null } : null
      const n = x as Named
      const name = n.name ?? n.label ?? n.value
      return name ? { value: name, label: name, icon: n.icon ?? null, color: n.color ?? null } : null
    })
    .filter((v): v is SkillLevelItem => v !== null)
  return items.length ? items : null
}

// Wires the cached fetch to the seed-label translator and re-exposes the
// resolved items as both the full-object `levels` and the legacy plain-string
// `names`, so neither caller shape breaks.
export function useSkillLevels() {
  const { t } = useTranslation('common')
  // The endpoint now exists (item 11) — a real 404 should surface in the dev log again.
  const { data: rawLevels } = useCachedLookup('/skill-levels', mapSkillLevels, DEFAULT_SKILL_LEVEL_ITEMS)
  // Seeded defaults render in the user language; a tenant value stays as typed (LOOKUP-I18N-1).
  // `levels` stays the full-object shape (icon/color intact); `names` is the
  // backward-compatible plain-string list for any old string[]-only call-site.
  // Both are derived inside the same memo so `names` shares levelItems' stable identity.
  const { levelItems, names } = useMemo(() => {
    const items = translateSeedList(t, 'skillLevels', rawLevels)
    return { levelItems: items, names: items.map(l => l.label) }
  }, [rawLevels, t])
  return { levels: levelItems, names }
}
