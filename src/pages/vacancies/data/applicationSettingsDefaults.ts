/**
 * applicationSettingsDefaults — the tenant-level fallback for a vacancy's
 * application form settings (cv/cover_letter/photo/remarks/interview_consent),
 * shared by the drawer's PublishingTab and the "+ Vacature" create form's
 * PublicationCard so the two never drift into two different fallback objects.
 */
export const VACANCY_APP_DEFAULTS_KEY = 'vacancy_default_application_settings'

export const FALLBACK_APP_SETTINGS = {
  cv: 'required', cover_letter: 'optional', photo: 'optional', remarks: 'optional', interview_consent: 'hidden',
}
