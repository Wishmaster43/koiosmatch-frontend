/**
 * vacancies — PUBLIC surface (§2 barrel decision, Danny 21-08).
 * Everything another entity may import from this folder lives HERE; anything
 * not exported below is internal and off-limits cross-entity (lint-enforced).
 * Whoever changes a module re-exported here knows outsiders ride along —
 * extend this list deliberately, never bypass it with a deep import.
 */
export { default as AddVacancyModal } from './AddVacancyModal'
export { mapVacancyDetail } from './data/mapVacancy'
export { buildVacancyPatch } from './data/vacanciesShared'
export { deriveVacancyAdvice } from './data/vacancyAdvice'
export { default as DescriptionTab } from './drawer/DescriptionTab'
export { default as DetailsTab } from './drawer/DetailsTab'
export { useCustomerOptions } from './hooks/useCustomerOptions'
export type { CustomerOption } from './hooks/useCustomerOptions'
export { getCandidateTabDefaults } from './lib/candidateTabVisibility'
export { default as VacancyDescriptionPopout } from './popout/VacancyDescriptionPopout'
