/**
 * koiosAdviceKeys — the tenant-setting key constants behind the Koios advice
 * thresholds and the per-application-stage staleness overrides (SETTINGS-UNIT-PAIRS-1).
 * Pulled out of KoiosAdviceSettings.tsx so StageWindowMapField/WindowUnitField can
 * reference the same keys without importing the screen component (avoids a cycle).
 */
export const VACANCY_ADVICE_STALE_DAYS_KEY = 'vacancy_advice_stale_days'
// O23 UNIT-NAAST-BEDRAG-1: the unit vacancy_advice_stale_days is expressed in.
export const VACANCY_ADVICE_STALE_DAYS_UNIT_KEY = 'vacancy_advice_stale_days_unit'
export const MATCH_ADVICE_RENEW_DAYS_KEY = 'match_advice_renew_days'
// WINDOW-UNIT-READERS-1: the unit match_advice_renew_days is expressed in — the
// picker renders only once the BE catalogue lists this key (feature detection).
export const MATCH_ADVICE_RENEW_DAYS_UNIT_KEY = 'match_advice_renew_days_unit'
export const APPLICATION_STAGE_STALE_DAYS_KEY = 'application_stage_stale_days'
// SETTINGS-UNIT-PAIRS-1: the unit application_stage_stale_days is expressed in.
export const APPLICATION_STAGE_STALE_DAYS_UNIT_KEY = 'application_stage_stale_days_unit'
// STAGE-STALE-PER-PHASE-1: the per-stage override map (one JSON string).
export const APPLICATION_STAGE_STALE_BY_PHASE_KEY = 'application_stage_stale_by_phase'
