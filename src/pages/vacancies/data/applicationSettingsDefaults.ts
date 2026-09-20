/**
 * applicationSettingsDefaults — the tenant-level fallback for a vacancy's
 * application form settings (cv/cover_letter/photo/remarks/interview_consent),
 * shared by the drawer's PublishingTab and the "+ Vacature" create form's
 * PublicationCard so the two never drift into two different fallback objects.
 * Re-exported from lib/settings/vacancyApplicationDefaults (the actual single
 * source, D1 fix) so this entity-local path keeps working for these consumers.
 */
export { VACANCY_APP_DEFAULTS_KEY, FALLBACK_APP_SETTINGS } from '@/lib/settings/vacancyApplicationDefaults'
