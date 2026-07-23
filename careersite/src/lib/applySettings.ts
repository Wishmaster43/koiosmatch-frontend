import type { ApplicationSettings, VacancyDetail } from '../types'

// Documented backend defaults (CareerVacancyDetailResource::applyFormSettings) —
// used whenever application_settings, or one of its keys, is missing on the
// response, so an older/incomplete API payload still renders the correct
// default field visibility instead of crashing or hiding everything.
const DEFAULT_APPLICATION_SETTINGS: ApplicationSettings = {
  cv: 'optional',
  cover_letter: 'optional',
  photo: 'hidden',
  remarks: 'optional',
  interview_consent: 'optional',
}

// Tolerant reader: fills in the documented default for any missing key rather
// than assuming the vacancy detail always carries a complete object.
export function getApplicationSettings(vacancy: Pick<VacancyDetail, 'application_settings'>): ApplicationSettings {
  const stored = vacancy.application_settings ?? {}
  return {
    cv: stored.cv ?? DEFAULT_APPLICATION_SETTINGS.cv,
    cover_letter: stored.cover_letter ?? DEFAULT_APPLICATION_SETTINGS.cover_letter,
    photo: stored.photo ?? DEFAULT_APPLICATION_SETTINGS.photo,
    remarks: stored.remarks ?? DEFAULT_APPLICATION_SETTINGS.remarks,
    interview_consent: stored.interview_consent ?? DEFAULT_APPLICATION_SETTINGS.interview_consent,
  }
}
