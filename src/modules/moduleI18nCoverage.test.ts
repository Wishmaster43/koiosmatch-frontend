/**
 * Module registry i18n coverage guard (§5) — every FIELD LABEL and hint/help
 * string the workflow module registry defines must have a `workflows:fieldLabels.*`
 * / `workflows:fieldHints.*` key in `en`, and every registry CATEGORY must resolve
 * through `categorySlug()` to an `en` `categories.*` key. Mirrors exactly how the
 * render layer consumes the registry (ConfigPanel/fields.tsx/fieldControls/ use
 * `fieldLabel()`/`fieldHint()` for these two shapes) — see moduleI18n.ts.
 *
 * Registry `options` (select/multiselect values) render through the SEPARATE
 * `optionLabel()` -> `fieldOptions.*` bucket (fields.tsx/MultiSelectField.tsx), keyed by
 * the option's LABEL text for a `{ value, label }` option and by the value for a plain
 * string option. Since MODULES-EN-1 round 2 this file guards that bucket as well: an object
 * option's label is its own en value and has a fieldOptions key in every locale (the first
 * pass renamed the labels and missed the keys; nothing caught it, hence this guard).
 */
import { describe, it, expect } from 'vitest'
import { MODULE_META, MODULE_SCHEMAS } from '@/modules/index'
import { i18nKey, categorySlug } from '@/components/layout/workflow/moduleI18n'
import enJson from '@/i18n/locales/en/workflows.json'

// MODULES-EN-1 (FILES-EN-1): every shipped locale's workflows.json, loaded like registryI18n.test.ts does.
const localeModules = import.meta.glob('../i18n/locales/*/workflows.json', { eager: true, import: 'default' }) as Record<string, {
  fieldLabels?: Record<string, string>
  fieldOptions?: Record<string, string>
}>
const LOCS = ['nl', 'en', 'de', 'fr', 'es', 'it', 'pt']

type Field = Record<string, unknown>

// The generated literal JSON type has no index signature; widen it for lookups.
const en = enJson as unknown as {
  fieldLabels?: Record<string, string>
  fieldOptions?: Record<string, string>
  fieldHints?: Record<string, string>
  categories?: Record<string, string>
}

const labels = new Set<string>()
const hints = new Set<string>()
// Only the `label:` TEXTS (not a nested field key standing in for its label): these are the
// registry's English source strings and must equal their en value (MODULES-EN-1).
const labelTexts = new Set<string>()
// `{ value, label }` option labels of select/multiselect fields (the fieldOptions bucket).
const optionLabels = new Set<string>()

// Walk one config-panel field: its own label/hint/help, plus a `filters`-type
// field's nested `fields` (FiltersField renders those through fieldLabel() too,
// same bucket as a top-level field), plus its `options` (hint/help only — see
// header note on why option labels stay out of this bucket).
function walkField(field: Field) {
  if (typeof field.label === 'string' && field.label) { labels.add(field.label); labelTexts.add(field.label) }
  if (typeof field.hint === 'string' && field.hint) hints.add(field.hint)
  if (typeof field.help === 'string' && field.help) hints.add(field.help)

  if (Array.isArray(field.fields)) {
    for (const nested of field.fields) {
      if (typeof nested === 'string') labels.add(nested)
      else if (nested && typeof nested === 'object') {
        const n = nested as Field
        const lbl = typeof n.label === 'string' ? n.label : n.value
        if (typeof lbl === 'string') labels.add(lbl)
        if (typeof n.label === 'string') labelTexts.add(n.label)
      }
    }
  }

  if (Array.isArray(field.options)) {
    for (const opt of field.options) {
      if (opt && typeof opt === 'object') {
        const o = opt as Field
        if (typeof o.label === 'string' && o.label && (field.type === 'select' || field.type === 'multiselect')) optionLabels.add(o.label)
        if (typeof o.hint === 'string' && o.hint) hints.add(o.hint)
        if (typeof o.help === 'string' && o.help) hints.add(o.help)
      }
    }
  }
}

for (const schema of Object.values(MODULE_SCHEMAS)) {
  for (const field of (schema ?? []) as Field[]) walkField(field)
}

describe('module registry label/hint i18n coverage (en/workflows.json)', () => {
  it('found registry labels/hints to check (sanity)', () => {
    expect(labels.size).toBeGreaterThan(50)
    expect(hints.size).toBeGreaterThan(20)
  })

  it('every field label has an en fieldLabels key', () => {
    const missing = [...labels].filter(l => en.fieldLabels?.[i18nKey(l)] == null)
    expect(missing, `missing en fieldLabels: ${missing.join(' | ')}`).toEqual([])
  })

  // MODULES-EN-1 (FILES-EN-1, 05-11): the registry label IS the English text, so its key is English too;
  // nl is a translation like any other locale. A Dutch (or otherwise divergent) source label fails here.
  it('every field label equals its own en value (the label is the English source text)', () => {
    const off = [...labelTexts].filter(l => en.fieldLabels?.[i18nKey(l)] !== l)
    expect(off, `label differs from its en fieldLabels value: ${off.join(' | ')}`).toEqual([])
  })

  for (const loc of LOCS) {
    it(`${loc}/workflows.json carries a fieldLabels key for every field label`, () => {
      const file = Object.entries(localeModules).find(([p]) => p.includes(`/${loc}/`))?.[1]
      expect(file, `${loc}/workflows.json not found`).toBeTruthy()
      const missing = [...labels].filter(l => file?.fieldLabels?.[i18nKey(l)] == null)
      expect(missing, `missing in ${loc}: ${missing.join(' | ')}`).toEqual([])
    })
  }

  it('every select option label equals its own en fieldOptions value', () => {
    expect(optionLabels.size).toBeGreaterThan(10)
    const off = [...optionLabels].filter(l => en.fieldOptions?.[i18nKey(l)] !== l)
    expect(off, `option label differs from its en fieldOptions value: ${off.join(' | ')}`).toEqual([])
  })

  for (const loc of LOCS) {
    it(`${loc}/workflows.json carries a fieldOptions key for every select option label`, () => {
      const file = Object.entries(localeModules).find(([p]) => p.includes(`/${loc}/`))?.[1]
      const missing = [...optionLabels].filter(l => file?.fieldOptions?.[i18nKey(l)] == null)
      expect(missing, `missing in ${loc}: ${missing.join(' | ')}`).toEqual([])
    })
  }

  it('every hint/help string has an en fieldHints key', () => {
    const missing = [...hints].filter(h => en.fieldHints?.[i18nKey(h)] == null)
    expect(missing, `missing en fieldHints: ${missing.join(' | ')}`).toEqual([])
  })

  it('every registry category resolves through categorySlug to an en categories key', () => {
    const used = new Set(
      Object.values(MODULE_META)
        .map(m => (m as { category?: string }).category)
        .filter((c): c is string => !!c)
    )
    const missing = [...used].filter(c => en.categories?.[categorySlug(c)] == null)
    expect(missing, `category slugs missing an en label: ${missing.join(' | ')}`).toEqual([])
  })
})
