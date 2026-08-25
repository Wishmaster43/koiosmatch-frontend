/**
 * lookupSeedI18n — LOOKUP-I18N-1 (Danny 25-08: "C, maar zorg dat alles vertaald is in
 * EN, DE, ES, FR"). Tenant lookups are DATA, not copy, so they are seeded in Dutch and
 * stay in the language the tenant typed. The one exception is the product's own seeded
 * default: while a value still carries the exact label the seed shipped, it is our text,
 * not theirs, and it renders in the user's language.
 *
 * The rename guard is the point: a tenant who renames "Beschikbaar" to "Inzetbaar" keeps
 * "Inzetbaar" in every language. We only translate what nobody has touched, so the app
 * never overwrites something a human typed. A tenant-created value has no catalogue entry
 * and passes through untouched as well.
 *
 * Pure module on purpose: no react, no i18n import (that would drag the i18n init into
 * every consumer's test tree, the barrel lesson of 25-08). The caller hands in `t` and
 * memoises the result, because these arrays land in dependency arrays (SEED-IDENTITY-1).
 */
import { LABEL_KEYED, SEED_LABELS } from './lookupSeedCatalogue'

// The shape every lookup row shares: a stable-ish value plus the label the server sent.
export interface SeedTranslatable { value?: string | null; label?: string | null }

type TFn = (key: string, opts?: { defaultValue?: string }) => string

// Compare labels the way a human would: case, accents and outer spacing do not decide
// whether a tenant renamed something.
const normalise = (s: string): string =>
  s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

// camelCase key from a Dutch seed label, for the families whose rows carry only a uuid.
// Must match the generator in the catalogue header exactly.
export function labelKey(label: string): string {
  const parts = label.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').split(/[^A-Za-z0-9]+/).filter(Boolean)
  if (!parts.length) return 'x'
  return parts[0].toLowerCase() + parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('')
}

/**
 * The translation key for one row, or null when this row is not a seeded default:
 * unknown family, tenant-created value, or a value whose label the tenant changed.
 */
export function seedKeyFor(family: string, item: SeedTranslatable): string | null {
  const seeds = SEED_LABELS[family]
  const label = item?.label ?? ''
  if (!seeds || !label) return null
  const key = LABEL_KEYED.has(family) ? labelKey(label) : String(item?.value ?? '')
  const seeded = key ? seeds[key] : undefined
  // Slug families need the label check (the value survives a rename); label families get
  // it for free, since a renamed label simply does not resolve to a catalogue key.
  if (seeded !== undefined) return normalise(seeded) === normalise(label) ? key : null
  // Records often embed only the flat label the server rendered (application.phaseLabel,
  // candidate.stageLabel), with no lookup value alongside. Match on the seeded label
  // instead — equally safe, because an unchanged label is what makes a row translatable.
  if (!LABEL_KEYED.has(family)) {
    const wanted = normalise(label)
    const byLabel = Object.keys(seeds).find(k => normalise(seeds[k]) === wanted)
    return byLabel ?? null
  }
  return null
}

/** One row's display label: translated when it is still the seeded default, else as typed. */
export function translateSeedLabel(t: TFn, family: string, item: SeedTranslatable): string {
  const label = item?.label ?? ''
  const key = seedKeyFor(family, item)
  return key ? t(`lookupSeeds.${family}.${key}`, { defaultValue: label }) : label
}

/**
 * Same, for a whole list. Returns a NEW array, so every call site memoises it on
 * [items, t] — a fresh identity per render took the tasks page down on 25-08.
 */
export function translateSeedList<T extends SeedTranslatable>(t: TFn, family: string, items: T[]): T[] {
  if (!Array.isArray(items) || !items.length) return items
  return items.map(item => {
    const translated = translateSeedLabel(t, family, item)
    return translated === item.label ? item : { ...item, label: translated }
  })
}
