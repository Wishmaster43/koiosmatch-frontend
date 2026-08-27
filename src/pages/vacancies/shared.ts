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
// useCustomerOptions moved to @/hooks (generic customer lookup, BARREL-DATETIME-LES).
export { getCandidateTabDefaults } from './lib/candidateTabVisibility'
export { default as VacancyDescriptionPopout } from './popout/VacancyDescriptionPopout'
// APP-VAC-TAB-1: the remaining drawer tabs, re-exported so the application
// drawer's Vacature tab can embed the REAL vacancy drill-down (all of
// VacancyDrawer's non-gated tabs) instead of a thin Details+Description
// summary — mirrors how applications/drawer/CandidateTab embeds the candidate
// drawer's own tab set via this same shared surface.
export { default as ApplicantsTab } from './drawer/ApplicantsTab'
export { default as AppointmentsTab } from './drawer/AppointmentsTab'
export { default as DocumentsTab } from './drawer/DocumentsTab'
export { default as MatchesTab } from './drawer/MatchesTab'
export { default as MatchingTab } from './drawer/MatchingTab'
export { default as NotesTab } from './drawer/NotesTab'
export { default as PublishingTab } from './drawer/PublishingTab'
export { default as StatisticsTab } from './drawer/StatisticsTab'
export { default as TimelineTab } from './drawer/TimelineTab'
export { default as VacancyAgentTab } from './drawer/VacancyAgentTab'
export { default as VacancyTasksTab } from './drawer/VacancyTasksTab'
