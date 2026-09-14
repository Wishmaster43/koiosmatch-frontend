// Settings registry — candidate-domain groups: Candidate, Applications.
// Extracted from registry.tsx (REGISTRY-SPLIT-1) in original array order; registry.tsx
// concatenates this with the other registry/groups.* modules to build NAV_GROUPS.
import {
  Users, Briefcase, Target, Tags, Globe, ShieldOff, Star, FileText, Car, Palette, UserCheck,
  BarChart2, GraduationCap, Flag, Clock, ClipboardList, Radio, XCircle, Mail,
} from 'lucide-react'
import type { NavGroup } from './types'

import FunctionsSettings from '../sections/FunctionsSettings'
import { ContractFormsSettings, FunnelStagesSettings, CandidateStatusesSettings, CandidatePhasesSettings } from '../sections/CandidateLookupsSettings'
import NationalitiesSettings from '../sections/NationalitiesSettings'
import BlacklistReasonsSettings from '../sections/BlacklistReasonsSettings'
import PoolsSettings from '../sections/PoolsSettings'
import CvTemplateSettings from '../sections/CvTemplateSettings'
import DriverLicenseSettings from '../sections/DriverLicenseSettings'
import { CandidateConversionSettings } from '../sections/CandidateConversionSettings'
import CandidateVacancyTabSettings from '../sections/CandidateVacancyTabSettings'
import { SkillLevelSettings } from '../sections/SkillLevelSettings'
import EducationLevelsSettings from '../sections/EducationLevelsSettings'
import CandidateRequiredFieldsSettings from '../sections/CandidateRequiredFieldsSettings'
import RetentionSettings from '../sections/RetentionSettings'
import CatalogSection from '../sections/CatalogSection'
import ApplicationSourcesSettings from '../sections/ApplicationSourcesSettings'
import RejectionSettings from '../sections/RejectionSettings'
import ProposalSettings from '../sections/ProposalSettings'
import ApplicationRequiredFieldsSettings from '../sections/ApplicationRequiredFieldsSettings'
import candidateDisplay from '../schemas/candidateDisplay'
import applicationDisplay from '../schemas/applicationDisplay'

// Candidate and Applications groups, in original NAV_GROUPS order.
export const candidateGroups: NavGroup[] = [
  {
    // Candidate-specific settings (Danny: "Kandidaat").
    key: 'candidate', icon: Users,
    items: [
      // Candidate function list — moved INTO the candidate group (Danny 24-07,
      // translated: "must go to the candidate and can just be called Functions"
      // — verbatim: "moet naar de kandidaat en kan gewoon Functies heten"); contact-person
      // titles stay the separate contact_functions item under `contacts`.
      { id: 'functions', icon: Briefcase, component: FunctionsSettings, logName: 'job_functions' },
      { id: 'candidate_phases', icon: Target, component: CandidatePhasesSettings, logName: 'candidate_phases' },
      { id: 'candidate_statuses', icon: Users, component: CandidateStatusesSettings, logName: 'candidate_statuses' },
      { id: 'contract_forms', icon: Tags, component: ContractFormsSettings, logName: 'candidate_types' },
      // Nationality lookup (audit finding NATIONALITY-1) — candidate.nationality was
      // a free-text field with no tenant-managed vocabulary; mirrors genders/industries.
      { id: 'nationalities', icon: Globe, component: NationalitiesSettings, logName: 'nationalities' },
      // Blacklist reason lookup (audit finding BLACKLIST-REASON-1) — the deployability
      // status "Blacklist" (§3B) needs its own reason vocabulary, distinct from the
      // generic status-reason free text; own icon so it reads as a flag, not a status.
      // Candidate half only — the customer vocabulary lives in the customers group
      // (translated: "customer with customer, candidate with candidate" —
      // verbatim: "klant bij klant, kandidaat bij kandidaat", Danny 2026-08-05).
      { id: 'blacklist_reasons', icon: ShieldOff, render: () => <BlacklistReasonsSettings entity="candidate" />, logName: 'candidate_blacklist_reasons' },
      { id: 'pools', icon: Star, component: PoolsSettings, logName: 'pools' },
      { id: 'cv_template', icon: FileText, component: CvTemplateSettings },
      // Document types moved OUT to their own top-level `document_types` group
      // below (DOCTYPE-ENTITY-1/DOCTYPE-STRICT-1) — the lookup now spans every
      // entity the backend supports, not just the candidate, mirroring note_types.
      { id: 'driver_licenses', icon: Car, component: DriverLicenseSettings, logName: 'driver_licenses' },
      { id: 'candidate_display', icon: Palette, schema: candidateDisplay },
      // Conversion behaviour: default deployability status after Lead → Kandidaat.
      { id: 'candidate_conversion', icon: UserCheck, component: CandidateConversionSettings },
      // Vacatures-tab visibility (Danny 23-07): per phase/status gate for the
      // drawer's vacancySearch tab — see CandidateVacancyTabSettings + vacancyTabVisibility.ts.
      { id: 'candidate_vacancy_tab', icon: Briefcase, component: CandidateVacancyTabSettings },
      { id: 'candidate_skill_levels', icon: BarChart2, component: SkillLevelSettings, logName: 'skill_levels' },
      // Education level lookup (KAND-NIVEAU-1) — dropdown for candidate_educations.level_id,
      // sibling to the skill-level lookup above; distinct from the unrelated
      // vacancy_education item (a separate vacancy-side education REQUIREMENT lookup).
      { id: 'candidate_education_levels', icon: GraduationCap, component: EducationLevelsSettings, logName: 'education_levels' },
      // Candidate custom fields moved to the shared "Eigen velden" group below
      // (§3B custom-fields wave) — one CRUD implementation for every entity.
      { id: 'candidate_required_fields', icon: Flag, component: CandidateRequiredFieldsSettings },
      // AVG-RET-2 (Danny 22-07 punt 8): tenant retention windows (never-placed /
      // ever-placed) behind the candidate's read-only "Bewaren tot" derivation.
      { id: 'candidate_retention', icon: Clock, component: RetentionSettings },
      // CATALOG-EMBED-1 (Danny 13-09): the catalogue's "windows" section, candidates
      // group — signal/alert day-windows scoped to the candidate, own page rather
      // than the retired catalog/windows nav item.
      { id: 'candidate_windows', icon: Clock, render: () => <CatalogSection section="windows" group="candidates" /> },
    ],
  },
  {
    // Application (sollicitatie) lookups — funnel stages + rejection reasons live on the
    // application, not the candidate (Danny). Rejection messaging is handled by workflows.
    key: 'applications', icon: ClipboardList,
    items: [
      { id: 'funnel_stages', icon: Target, component: FunnelStagesSettings, logName: 'application_stages' },
      // Acquisition-source lookup (S-SOURCE-1 GRADUATION, 2026-08-14) — backed by
      // /candidate-sources (the backend's shared CandidateSource lookup, also fed
      // into the candidate intake source field once that surface gets its own
      // picker); lives here because the application create/edit surfaces
      // (AddApplicationModal, ApplicationDetailsCard) are its only FE consumers today.
      // NOT YET AUDITED (fixround F): candidate_rejection_reasons and candidate_sources
      // tables lack the audit trait; audit trail omitted until backend adds it.
      { id: 'application_sources', icon: Radio, component: ApplicationSourcesSettings, logName: null },
      { id: 'rejection', icon: XCircle, component: RejectionSettings, logName: null },
      { id: 'application_proposal', icon: Mail, component: ProposalSettings },
      { id: 'application_display', icon: Palette, schema: applicationDisplay },
      // APP-REQUIRED-FE-1: flat required-fields toggle list for the "nieuwe
      // sollicitatie" popup (source / vacancy / owner / phase) — same Flag icon
      // as the candidate/customer required-fields items, so it reads as "the
      // same thing on another entity".
      { id: 'application_required_fields', icon: Flag, component: ApplicationRequiredFieldsSettings },
      // CATALOG-EMBED-1: the catalogue's "windows" section, applications group.
      { id: 'application_windows', icon: Clock, render: () => <CatalogSection section="windows" group="applications" /> },
    ],
  },
]
