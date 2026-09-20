/**
 * vacancyApplicationDefaults — the ONE source for the tenant-level fallback of a
 * vacancy's application form settings (cv/cover_letter/photo/remarks/interview_consent).
 * Lives in the neutral lib/settings tree (not under pages/vacancies) so the Settings
 * screen that WRITES the tenant default (VacancySettings.tsx) can import it without a
 * deep cross-entity path into pages/vacancies (§2 barrel rule) or pulling in that
 * entity's whole eager barrel (BARREL-DATETIME-LES) just for two constants.
 * pages/vacancies/data/applicationSettingsDefaults.ts re-exports this so its existing
 * consumers (PublishingTab, useAddVacancyLookups, useAddVacancyForm) are unaffected.
 */
export const VACANCY_APP_DEFAULTS_KEY = 'vacancy_default_application_settings'

export const FALLBACK_APP_SETTINGS = {
  cv: 'required', cover_letter: 'optional', photo: 'optional', remarks: 'optional', interview_consent: 'hidden',
}
