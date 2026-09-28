// The module registry's `category` field IS the i18n slug already (ENGLISH-CODE-1:
// MODULE-CATEGORY-EN-1 dropped the old Dutch source values), so this is now
// identity + a safe fallback. Kept as a function so callers never need to change.
export const categorySlug = (cat?: string) => cat || 'other'

/**
 * Field-label / option translation for the module registry (§5: the workflow editor is
 * NOT exempt from i18n). The registry keeps its Dutch source labels (they're also the
 * persisted option VALUES — never change those); the render layer translates via
 * `workflows:fieldLabels.*` / `workflows:fieldOptions.*` with the raw label as fallback,
 * so untranslated/technical values (GET, JSON, model names) render as-is. Keys strip
 * i18next's separators (. and :) and flatten newlines (multi-line placeholders).
 */
type TFn = (key: string, opts?: { defaultValue?: string }) => string
export const i18nKey = (s: string) => s.replace(/[.:]/g, '').replace(/\n/g, ' ')

export const fieldLabel = (t: TFn, label?: string): string =>
  label ? t('fieldLabels.' + i18nKey(label), { defaultValue: label }) : ''

export const optionLabel = (t: TFn, value?: string): string =>
  value ? t('fieldOptions.' + i18nKey(value), { defaultValue: value }) : ''

// Registry `placeholder:` strings — same mechanism, `workflows:fieldPlaceholders.*`.
// Language-neutral placeholders (numbers, URLs, tokens) simply have no key and fall back.
export const fieldPlaceholder = (t: TFn, placeholder?: string): string =>
  placeholder ? t('fieldPlaceholders.' + i18nKey(placeholder), { defaultValue: placeholder }) : ''

// Registry `hint:`/`help:` strings — helper text under a field, `workflows:fieldHints.*`.
export const fieldHint = (t: TFn, hint?: string): string =>
  hint ? t('fieldHints.' + i18nKey(hint), { defaultValue: hint }) : ''
