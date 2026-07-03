/**
 * moduleI18n — maps a module's registry category (Dutch source value) to its i18n
 * slug, so ModulePicker/ConfigPanel can render `t('workflows:categories.<slug>')`
 * while the filtering/grouping keeps matching on the raw registry category.
 */
export const CATEGORY_SLUG: Record<string, string> = {
  'Alle': 'all', 'Triggers': 'triggers', 'Kandidaten': 'candidates', 'Sollicitaties': 'applications',
  'Vacatures': 'vacancies', 'Matches': 'matches', 'Kansen': 'opportunities', 'Taken': 'tasks',
  'Klanten': 'customers', 'Planning': 'planning', 'Communicatie': 'communication', 'AI': 'ai',
  'ShiftManager': 'shiftmanager', 'HelloFlex': 'helloflex', 'Intus': 'intus', 'Flow beheer': 'flow',
  'Tekst & Parsing': 'text', 'Overig': 'other',
}

export const categorySlug = (cat?: string) => CATEGORY_SLUG[cat ?? ''] ?? 'other'

/**
 * Field-label / option translation for the module registry (§5: the workflow editor is
 * NOT exempt from i18n). The registry keeps its Dutch source labels (they're also the
 * persisted option VALUES — never change those); the render layer translates via
 * `workflows:fieldLabels.*` / `workflows:fieldOptions.*` with the raw label as fallback,
 * so untranslated/technical values (GET, JSON, model names) render as-is. Keys strip
 * i18next's separators (. and :) from the Dutch source.
 */
type TFn = (key: string, opts?: { defaultValue?: string }) => string
const i18nKey = (s: string) => s.replace(/[.:]/g, '')

export const fieldLabel = (t: TFn, label?: string): string =>
  label ? t('fieldLabels.' + i18nKey(label), { defaultValue: label }) : ''

export const optionLabel = (t: TFn, value?: string): string =>
  value ? t('fieldOptions.' + i18nKey(value), { defaultValue: value }) : ''
