/**
 * vacancies — LIGHT public surface (VACTAB-BARREL-GEWICHT-1): pure functions
 * and types only, ZERO component imports. Light cross-entity consumers (report
 * panel groups, advice hooks, mappers) import HERE so they never pay for the
 * drawer/tab tree that shared.ts eager-loads; shared.ts remains the surface
 * for embedding real components. Adding a COMPONENT export here is a finding.
 */
export { mapVacancyDetail } from './data/mapVacancy'
export { buildVacancyPatch } from './data/vacanciesShared'
export { deriveVacancyAdvice } from './data/vacancyAdvice'
export { getCandidateTabDefaults } from './lib/candidateTabVisibility'
