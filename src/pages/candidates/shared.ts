/**
 * candidates — PUBLIC surface (§2 barrel decision, Danny 21-08).
 * Everything another entity may import from this folder lives HERE; anything
 * not exported below is internal and off-limits cross-entity (lint-enforced).
 * Whoever changes a module re-exported here knows outsiders ride along —
 * extend this list deliberately, never bypass it with a deep import.
 */
export { default as AddCandidateModal } from './AddCandidateModal'
export { CvDocument, groupCvSections } from './CandidateCvTemplate'
export type { CvCandidate, CvSettings, TranslateFn } from './CandidateCvTemplate'
export { paletteFor } from './cv/cvStyles'
export { buildCandidatePatch } from './data/candidatesShared'
export { mapCandidate } from './data/mapCandidate'
export { default as CandidateAddApplicationModal } from './drawer/AddApplicationModal'
export { default as ApplicationRow } from './drawer/ApplicationRow'
export { default as ApplicationRowDetails } from './drawer/ApplicationRowDetails'
export { default as BackgroundTab } from './drawer/BackgroundTab'
export { default as CommunicationTab } from './drawer/CommunicationTab'
export { default as DetachApplicationModal } from './drawer/DetachApplicationModal'
export { default as DocumentRow } from './drawer/DocumentRow'
export { default as DocumentsSection } from './drawer/DocumentsSection'
export { default as MatchModal } from './drawer/MatchModal'
export { default as PlanIntakeModal } from './drawer/PlanIntakeModal'
export type { ExistingAppointment } from './drawer/PlanIntakeModal'
export { PreferencesTab, ZzpTab } from './drawer/PreferencesZzpTabs'
export { default as ProfilePanel } from './drawer/ProfilePanel'
export { default as StatisticsTab } from './drawer/StatisticsTab'
export { default as WorkTab } from './drawer/WorkTab'
export { vacancyLabelOf } from './drawer/applicationRowModel'
export type { AppRow } from './drawer/applicationRowModel'
export { NL_PROVINCES } from './drawer/constants'
export { DOC_GRID_COLUMNS, docKey, docUrl, splitExt } from './drawer/documentHelpers'
export type { DocItem } from './drawer/documentHelpers'
export { useCandidateRecord } from './hooks/useCandidateMutations'
export { useCandidateNotes } from './hooks/useCandidateNotes'
export type { CandidateNote } from './hooks/useCandidateNotes'
export { useVacancyOptions } from './hooks/useVacancyOptions'
export { getVacancyTabDefaults } from './lib/vacancyTabVisibility'
