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
