/**
 * Vacancy list display preferences — how the vacancies table renders its chips.
 * One toggle per coloured column; off = plain text. Mirrors candidateDisplay/
 * customerDisplay. Reuses the flags VacanciesTable.tsx already reads (status/
 * published/owner) — this schema only adds the Settings UI for them.
 * Labels/descriptions live in i18n under `vacancyDisplay.*` (settings ns).
 */
export default {
  i18nKey: 'vacancyDisplay',
  fields: [
    // Status and "published" carry meaning → coloured chip ON by default.
    { key: 'vacancy_table_color_status',    type: 'toggle', default: true },
    { key: 'vacancy_table_color_published', type: 'toggle', default: true },
    // Owner avatar: recruiter colour (on, default) vs. neutral grey (off).
    { key: 'vacancy_table_color_owner',     type: 'toggle', default: true },
  ],
}
