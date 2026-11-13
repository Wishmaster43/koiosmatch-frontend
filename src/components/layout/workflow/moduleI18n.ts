import type { TFunction } from 'i18next'
import { labelOrRaw, type KeyChecker } from '@/lib/labelOrRaw'

// The module registry's `category` field IS the i18n slug already (ENGLISH-CODE-1:
// MODULE-CATEGORY-EN-1 dropped the old Dutch source values), so this is now
// identity + a safe fallback. Kept as a function so callers never need to change.
export const categorySlug = (cat?: string) => cat || 'other'

/**
 * Field-label / option translation for the module registry (§5: the workflow editor is
 * NOT exempt from i18n). Field LABELS are English source text since MODULES-EN-1 (05-11,
 * FILES-EN-1: the label is its own `fieldLabels.*` key, nl is a translation like any other
 * locale; moduleI18nCoverage.test guards label === en value). A `{ value, label }` option's
 * LABEL is English source text too and translates via `fieldOptions.*` keyed by that label;
 * plain string option VALUES stay as persisted (BE contract values, never renamed here) and
 * translate via `fieldOptions.*` keyed by the value.
 * Backend OUTPUT-field labels (StepOutputSlice) share the fieldLabels bucket under the text
 * the BE sends, so a handful of Dutch keys remain next to their English twins until the BE's
 * KOIOS-EN-1 mapping moves them. The raw string is the fallback, so technical values (GET, JSON,
 * model names) render as-is. Keys strip i18next's separators (. and :) and flatten newlines.
 */
// Structural t: the registry strings live in the workflows namespace, so every lookup names it.
type TFn = (key: string, opts?: { ns?: string }) => string
const NS = 'workflows'
// Translates `<bucket>.<key>` when the locale carries it, else the raw registry string as data: the one
// house rule (labelOrRaw); the structural t of the registry callers is cast once, here.
const translateOrRaw = (t: TFn, i18n: KeyChecker, key: string, raw: string): string =>
  labelOrRaw(t as unknown as TFunction, i18n, key, raw, NS)
export const i18nKey = (s: string) => s.replace(/[.:]/g, '').replace(/\n/g, ' ')

export const fieldLabel = (t: TFn, i18n: KeyChecker, label?: string): string =>
  label ? translateOrRaw(t, i18n, 'fieldLabels.' + i18nKey(label), label) : ''

export const optionLabel = (t: TFn, i18n: KeyChecker, value?: string): string =>
  value ? translateOrRaw(t, i18n, 'fieldOptions.' + i18nKey(value), value) : ''

// Registry `placeholder:` strings — same mechanism, `workflows:fieldPlaceholders.*`.
// Language-neutral placeholders (numbers, URLs, tokens) simply have no key and fall back.
export const fieldPlaceholder = (t: TFn, i18n: KeyChecker, placeholder?: string): string =>
  placeholder ? translateOrRaw(t, i18n, 'fieldPlaceholders.' + i18nKey(placeholder), placeholder) : ''

// Registry `hint:`/`help:` strings — helper text under a field, `workflows:fieldHints.*`.
export const fieldHint = (t: TFn, i18n: KeyChecker, hint?: string): string =>
  hint ? translateOrRaw(t, i18n, 'fieldHints.' + i18nKey(hint), hint) : ''
