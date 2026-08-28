/**
 * Module registry i18n coverage guard (§5) — every FIELD LABEL and hint/help
 * string the workflow module registry defines must have a `workflows:fieldLabels.*`
 * / `workflows:fieldHints.*` key in `en`, and every registry CATEGORY must resolve
 * through `categorySlug()` to an `en` `categories.*` key. Mirrors exactly how the
 * render layer consumes the registry (ConfigPanel/fields.tsx/fieldControls/ use
 * `fieldLabel()`/`fieldHint()` for these two shapes) — see moduleI18n.ts.
 *
 * Registry `options` (select/multiselect values) are walked too, but intentionally
 * NOT asserted against fieldLabels here: they render through the SEPARATE
 * `optionLabel()` -> `fieldOptions.*` bucket (fields.tsx/MultiSelectField.tsx), a
 * different i18n surface already guarded by registryI18n.test.ts / the module-key-gap
 * audit. This walk still visits them so a future option shape growing its own
 * `hint`/`help` is not silently skipped.
 */
import { describe, it, expect } from 'vitest'
import { MODULE_META, MODULE_SCHEMAS } from '@/modules/index'
import { i18nKey, categorySlug } from '@/components/layout/workflow/moduleI18n'
import enJson from '@/i18n/locales/en/workflows.json'

type Field = Record<string, unknown>

// The generated literal JSON type has no index signature; widen it for lookups.
const en = enJson as unknown as {
  fieldLabels?: Record<string, string>
  fieldHints?: Record<string, string>
  categories?: Record<string, string>
}

const labels = new Set<string>()
const hints = new Set<string>()

// Walk one config-panel field: its own label/hint/help, plus a `filters`-type
// field's nested `fields` (FiltersField renders those through fieldLabel() too,
// same bucket as a top-level field), plus its `options` (hint/help only — see
// header note on why option labels stay out of this bucket).
function walkField(field: Field) {
  if (typeof field.label === 'string' && field.label) labels.add(field.label)
  if (typeof field.hint === 'string' && field.hint) hints.add(field.hint)
  if (typeof field.help === 'string' && field.help) hints.add(field.help)

  if (Array.isArray(field.fields)) {
    for (const nested of field.fields) {
      if (typeof nested === 'string') labels.add(nested)
      else if (nested && typeof nested === 'object') {
        const n = nested as Field
        const lbl = typeof n.label === 'string' ? n.label : n.value
        if (typeof lbl === 'string') labels.add(lbl)
      }
    }
  }

  if (Array.isArray(field.options)) {
    for (const opt of field.options) {
      if (opt && typeof opt === 'object') {
        const o = opt as Field
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
