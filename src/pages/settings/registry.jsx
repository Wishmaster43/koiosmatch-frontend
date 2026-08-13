/**
 * Settings registry — the single source of truth for the settings area.
 *
 * Each group is a sidebar category (icon + i18n `groups.<key>`); its items become
 * the sub-tabs shown for that category. An item renders in one of three ways,
 * checked in this order by the shell:
 *
 *   render: () => <X/>   — full control (used for parametrised sections)
 *   schema: <schema>     — declarative section via <SchemaSection> (the easy path)
 *   component: Component  — a custom section component
 *
 * Labels: groups.<key> and nav.<id> in the `settings` i18n namespace.
 * Gating: superAdminOnly | requiresPage | (id === 'users') handled by the shell.
 *
 * Add a setting = one item here. A simple toggle/number setting = add a `schema`
 * (or a line to an existing schema) and skip writing a component entirely.
 */
import {
  AppWindow, BarChart2, Bell, BookOpen, Briefcase, Building2, CalendarCheck, CalendarDays, Car,
  ClipboardList, Clock, CreditCard, Download, EyeOff, Factory, FileText, Flag, GraduationCap, Hash, History, Key, LayoutGrid,
  ListChecks, Mail, MapPin, MessageCircle, MessageSquare, Languages, Megaphone, Package, Palette, Percent, Phone, Scale, Shield, SlidersHorizontal, Sparkles, Star,
  Boxes, Globe, Store, Tags, Target, Upload, UserCheck, Users, Webhook, XCircle,
  ShieldOff, AlertTriangle, ListTree, CheckCircle,
} from 'lucide-react'
import CustomFieldsSettings from './sections/CustomFieldsSettings'
import VacancyGenerationSettings from './sections/VacancyGenerationSettings'
import KoiosAdviceSettings from './sections/KoiosAdviceSettings'

import UsersPage from '../users/UsersPage'
import ViewConfigEditor from '@/components/settings/ViewConfigEditor'
import DashboardsSettings from './sections/DashboardsSettings'

import BrandSettings from './sections/BrandSettings'
import CompanySettings from './sections/CompanySettings'
import LocationsSettings from './sections/LocationsSettings'
import MemorySettings from './sections/MemorySettings'
import { ContractFormsSettings, FunnelStagesSettings, CandidateStatusesSettings, CandidatePhasesSettings } from './sections/CandidateLookupsSettings'
import { LastContactTypesSettings } from './sections/CandidateCommSettings'
import NoteTypesSettings from './sections/NoteTypesSettings'
import { CandidateConversionSettings } from './sections/CandidateConversionSettings'
import NumberingSettings from './sections/NumberingSettings'
import OrganisationPolicySettings from './sections/OrganisationPolicySettings'
import CareerSiteSettings from './sections/CareerSiteSettings'
import CaoSettings from './sections/CaoSettings'
import { CustomerStatusesSettings, CustomerPhasesSettings, LocationStatusesSettings, DepartmentStatusesSettings, ContactStatusesSettings } from './sections/CustomerSettings'
import PoolsSettings from './sections/PoolsSettings'
import { LanguageListSettings, LanguageLevelSettings } from './sections/LanguageSettings'
import GenderSettings from './sections/GenderSettings'
import IndustrySettings from './sections/IndustrySettings'
import ProvincesSettings from './sections/ProvincesSettings'
import FunctionsSettings from './sections/FunctionsSettings'
import ContactFunctionsSettings from './sections/ContactFunctionsSettings'
import { VacancyStatusSettings, VacancyPhaseSettings, VacancySenioritySettings, VacancyEducationSettings, VacancyChannelSettings, VacancyApplicationDefaultsSettings } from './sections/VacancySettings'
import VacancyDefaultStatusSettings from './sections/VacancyDefaultStatusSettings'
import VacancyMatchingSettings from './sections/VacancyMatchingSettings'
import VacancyCandidateTabSettings from './sections/VacancyCandidateTabSettings'
import CustomerDisplaySettings from './sections/CustomerDisplaySettings'
import CustomerRequiredFieldsSettings from './sections/customers/CustomerRequiredFieldsSettings'
import IdentifierValidationSettings from './sections/customers/IdentifierValidationSettings'
import { CustomerConversionSettings } from './sections/CustomerConversionSettings'
import MatchTemplatesSettings from './sections/MatchTemplatesSettings'
import MatchRatesSettings from './sections/MatchRatesSettings'
import { TaskStatusSettings, TaskTypeSettings, TaskPrioritySettings } from './sections/TaskSettings'
import { MatchStatusSettings, ContractTypesSettings, MatchStopReasonSettings } from './sections/MatchSettings'
import { AppointmentTypeSettings } from './sections/AppointmentTypeSettings'
import { AppointmentLocationSettings } from './sections/AppointmentLocationSettings'
import { SkillLevelSettings } from './sections/SkillLevelSettings'
import EducationLevelsSettings from './sections/EducationLevelsSettings'
import { OutreachStatusSettings, OutreachOutcomeSettings } from './sections/OutreachSettings'
import RejectionSettings from './sections/RejectionSettings'
import ProposalSettings from './sections/ProposalSettings'
import CandidateRequiredFieldsSettings from './sections/CandidateRequiredFieldsSettings'
import CandidateVacancyTabSettings from './sections/CandidateVacancyTabSettings'
import RetentionSettings from './sections/RetentionSettings'
// NATIONALITY-1 / BLACKLIST-REASON-1 / ESCALATION-REASON-1 / OPP-LOOKUPS-1 (audit findings).
import NationalitiesSettings from './sections/NationalitiesSettings'
import BlacklistReasonsSettings from './sections/BlacklistReasonsSettings'
import EscalationReasonsSettings from './sections/EscalationReasonsSettings'
import OpportunityLookupsSettings from './sections/OpportunityLookupsSettings'
import CvTemplateSettings from './sections/CvTemplateSettings'
import DocumentTypesSettings from './sections/DocumentTypesSettings'
import EmailSettings from './sections/EmailSettings'
import AuditLog from './sections/AuditLog'
import RolesSettings from './sections/RolesSettings'
import ShiftmanagerModuleSettings from './sections/ShiftmanagerModuleSettings'
import WebhooksSettings from './sections/webhooks'
import AppsSettings from './sections/AppsSettings'
import ModulesSettings from './sections/ModulesSettings'
import TenantUsageSettings from './sections/TenantUsageSettings'
import JobQueueSettings from './sections/jobs'
import WhatsAppSettings from './sections/WhatsAppSettings'
import ImporterenSettings from './sections/ImporterenSettings'
import ExportSettings from './sections/ExportSettings'
import FacebookLeadsSettings from './sections/FacebookLeadsSettings'
import ApiKeysSettings from './sections/apikeys'
import EmailLog from './sections/EmailLog'
import WhatsAppLog from './sections/WhatsAppLog'
import { WaMessageTypeSettings } from './sections/WaMessageTypeSettings'
import KoiosSettings from './sections/koios'
import NotificationsSettings from './sections/NotificationsSettings'
import EscalationSettings from './sections/EscalationSettings'
// Planning settings — gated on the 'plan' module (requiresPage: 'planning'); hidden until it is on.
import { ShiftTypesSettings, AvailabilitySettings, AutoMatchSettings, PlanningBoardSettings } from './sections/PlanningSettings'
import { FacturenSettings } from './sections/BillingSettings'
import GebruikSettings from './sections/GebruikSettings'

import {
  kpisLeads, kpisCandidates, kpisApplications, kpisCustomers, kpisLocations,
  kpisDepartments, kpisContacts, kpisTasks, kpisCalllists, kpisMatches,
} from './schemas/kpis'
import candidateDisplay from './schemas/candidateDisplay'
import customerVacancyDefaults from './schemas/customerVacancyDefaults'
import taskDisplay from './schemas/taskDisplay'
import applicationDisplay from './schemas/applicationDisplay'
import opportunityDisplay from './schemas/opportunityDisplay'
import vacancyDisplay from './schemas/vacancyDisplay'
import matchDisplay from './schemas/matchDisplay'
import outreachDisplay from './schemas/outreachDisplay'
import DriverLicenseSettings from './sections/DriverLicenseSettings'
import ActionRulesSettings from './sections/ActionRulesSettings'
import workflowRunHistory from './schemas/workflowRunHistory'

export const NAV_GROUPS = [
  {
    key: 'kpis', icon: Target,
    items: [
      // Sub-tabs per KPI area; labels via nav.<id>, fields share the `kpis.*` i18n.
      { id: 'kpis_leads', icon: Target, schema: kpisLeads },
      { id: 'kpis_candidates', icon: Users, schema: kpisCandidates },
      { id: 'kpis_applications', icon: ClipboardList, schema: kpisApplications },
      { id: 'kpis_customers', icon: Building2, schema: kpisCustomers },
      { id: 'kpis_locations', icon: MapPin, schema: kpisLocations },
      { id: 'kpis_departments', icon: Building2, schema: kpisDepartments },
      { id: 'kpis_contacts', icon: Users, schema: kpisContacts },
      { id: 'kpis_tasks', icon: ListChecks, schema: kpisTasks },
      { id: 'kpis_calllists', icon: Phone, schema: kpisCalllists },
      { id: 'kpis_matches', icon: Sparkles, schema: kpisMatches },
    ],
  },
  {
    // Company / organisation: profile, locations, brand + per-module view config.
    key: 'company', icon: Building2,
    items: [
      { id: 'company', icon: Building2, component: CompanySettings },
      { id: 'locations', icon: MapPin, component: LocationsSettings },
      { id: 'branding', icon: Palette, component: BrandSettings },
      // NUMMER-1: prefix/padding/start per entity for the human-readable reference numbers.
      { id: 'numbering', icon: Hash, component: NumberingSettings },
      // Org-wide policies (MFA enforcement, …) — own sub-menu next to numbering (Danny 23-07).
      { id: 'org_policy', icon: Shield, component: OrganisationPolicySettings },
      // Career site — its own sub-tab (Danny 23-07), out of the company-profile form.
      { id: 'career_site', icon: Globe, component: CareerSiteSettings },
    ],
  },
  {
    // Koios AI — all AI-flavoured settings together (Danny 21-07): the Koios overview,
    // the AI memory (moved here from Company), and the vacancy-generation CRUD surface.
    key: 'ai', icon: Sparkles,
    items: [
      { id: 'koios', icon: Sparkles, component: KoiosSettings },
      { id: 'memory', icon: BookOpen, component: MemorySettings },
      { id: 'vacancy_generation', icon: Sparkles, component: VacancyGenerationSettings },
      // Koios advice thresholds (old open Danny item): the stale-vacancy and
      // match-renewal day windows behind the "Koios" attention column on the
      // vacancies/matches tables — cross-entity Koios-rule config, so it sits
      // here rather than forcing a fit into either entity's display schema.
      { id: 'koios_advice', icon: Clock, component: KoiosAdviceSettings },
    ],
  },
  {
    // Personalisation = shared/general tenant lookups (used across candidates, customers, contacts, …).
    key: 'personalisation', icon: BookOpen,
    items: [
      { id: 'industries', icon: Factory, component: IndustrySettings },
      // Regions per country (PROVINCES-1) — tenant CRUD + reorder, cascaded on the
      // address country picker; sits next to Industries as a shared lookup.
      { id: 'provinces', icon: MapPin, component: ProvincesSettings },
      { id: 'lang_languages', icon: Languages, component: LanguageListSettings },
      { id: 'lang_levels', icon: BarChart2, component: LanguageLevelSettings },
      { id: 'genders', icon: Users, component: GenderSettings },
      { id: 'last_contact_types', icon: MessageCircle, component: LastContactTypesSettings },
    ],
  },
  {
    // Candidate-specific settings (Danny: "Kandidaat").
    key: 'candidate', icon: Users,
    items: [
      // Candidate function list — moved INTO the candidate group (Danny 24-07:
      // "moet naar de kandidaat en kan gewoon Functies heten"); contact-person
      // titles stay the separate contact_functions item under `contacts`.
      { id: 'functions', icon: Briefcase, component: FunctionsSettings },
      { id: 'candidate_phases', icon: Target, component: CandidatePhasesSettings },
      { id: 'candidate_statuses', icon: Users, component: CandidateStatusesSettings },
      { id: 'contract_forms', icon: Tags, component: ContractFormsSettings },
      // Nationality lookup (audit finding NATIONALITY-1) — candidate.nationality was
      // a free-text field with no tenant-managed vocabulary; mirrors genders/industries.
      { id: 'nationalities', icon: Globe, component: NationalitiesSettings },
      // Blacklist reason lookup (audit finding BLACKLIST-REASON-1) — the deployability
      // status "Blacklist" (§3B) needs its own reason vocabulary, distinct from the
      // generic status-reason free text; own icon so it reads as a flag, not a status.
      // Candidate half only — the customer vocabulary lives in the customers group
      // ("klant bij klant, kandidaat bij kandidaat", Danny 2026-08-05).
      { id: 'blacklist_reasons', icon: ShieldOff, render: () => <BlacklistReasonsSettings entity="candidate" /> },
      { id: 'pools', icon: Star, component: PoolsSettings },
      { id: 'cv_template', icon: FileText, component: CvTemplateSettings },
      // Document types moved OUT to their own top-level `document_types` group
      // below (DOCTYPE-ENTITY-1/DOCTYPE-STRICT-1) — the lookup now spans every
      // entity the backend supports, not just the candidate, mirroring note_types.
      { id: 'driver_licenses', icon: Car, component: DriverLicenseSettings },
      { id: 'candidate_display', icon: Palette, schema: candidateDisplay },
      // Conversion behaviour: default deployability status after Lead → Kandidaat.
      { id: 'candidate_conversion', icon: UserCheck, component: CandidateConversionSettings },
      // Vacatures-tab visibility (Danny 23-07): per phase/status gate for the
      // drawer's vacancySearch tab — see CandidateVacancyTabSettings + vacancyTabVisibility.ts.
      { id: 'candidate_vacancy_tab', icon: Briefcase, component: CandidateVacancyTabSettings },
      { id: 'candidate_skill_levels', icon: BarChart2, component: SkillLevelSettings },
      // Education level lookup (KAND-NIVEAU-1) — dropdown for candidate_educations.level_id,
      // sibling to the skill-level lookup above; distinct from the unrelated
      // vacancy_education item (a separate vacancy-side education REQUIREMENT lookup).
      { id: 'candidate_education_levels', icon: GraduationCap, component: EducationLevelsSettings },
      // Candidate custom fields moved to the shared "Eigen velden" group below
      // (§3B custom-fields wave) — one CRUD implementation for every entity.
      { id: 'candidate_required_fields', icon: Flag, component: CandidateRequiredFieldsSettings },
      // AVG-RET-2 (Danny 22-07 punt 8): tenant retention windows (never-placed /
      // ever-placed) behind the candidate's read-only "Bewaren tot" derivation.
      { id: 'candidate_retention', icon: Clock, component: RetentionSettings },
    ],
  },
  {
    // Application (sollicitatie) lookups — funnel stages + rejection reasons live on the
    // application, not the candidate (Danny). Rejection messaging is handled by workflows.
    key: 'applications', icon: ClipboardList,
    items: [
      { id: 'funnel_stages', icon: Target, component: FunnelStagesSettings },
      { id: 'rejection', icon: XCircle, component: RejectionSettings },
      { id: 'application_proposal', icon: Mail, component: ProposalSettings },
      { id: 'application_display', icon: Palette, schema: applicationDisplay },
    ],
  },
  {
    // Customer-domain lookups — statuses for the customer and its sub-entities.
    // contact_statuses moved out to its own `contacts` group below (Danny 2026-07-20,
    // FUNCTIONS-SPLIT-1) so every contact-person setting lives together.
    key: 'customers', icon: Building2,
    items: [
      // KLANT-FASE-1: lifecycle phase (Prospect → Klant) — same axis, same icon as the
      // candidate phase editor, so both read as "the same thing on another entity".
      { id: 'customer_phases', icon: Target, component: CustomerPhasesSettings },
      { id: 'customer_statuses', icon: Tags, component: CustomerStatusesSettings },
      // Customer half of the blacklist-reason vocabulary (KLANT-BLACKLIST-1) — lives
      // HERE, not as a sub-tab under candidates ("klant bij klant", Danny 2026-08-05).
      { id: 'customer_blacklist_reasons', icon: ShieldOff, render: () => <BlacklistReasonsSettings entity="customer" /> },
      // CAO lookup — feeds price agreements + the + Match popup (Danny 24-07).
      { id: 'cao', icon: Scale, component: CaoSettings },
      { id: 'location_statuses', icon: MapPin, component: LocationStatusesSettings },
      { id: 'department_statuses', icon: Building2, component: DepartmentStatusesSettings },
      // SUB-TABS-1 (Danny 02-08): was a single flat schema; now a component so the
      // customer-table settings and the three drill-down entity tables (+ Vacatures'
      // default filter) each get their own sub-tab — see CustomerDisplaySettings.
      { id: 'customer_display', icon: Palette, component: CustomerDisplaySettings },
      // KLANT-VERPLICHT-1 (Danny 02-08): required fields per klant-fase + the three
      // sub-entities — same Flag icon as the candidate's own required-fields item.
      { id: 'customer_required_fields', icon: Flag, component: CustomerRequiredFieldsSettings },
      // KVK/BTW-PER-LAND-1 (Danny 08-08, points 10 + 11): warn-vs-block on a KvK/BTW
      // number that does not match its country's format — the rules themselves are
      // real-world data (lib/companyIdentifiers), only the behaviour is tenant-set.
      { id: 'customer_identifier_validation', icon: Hash, component: IdentifierValidationSettings },
      // Conversion behaviour: default status after Prospect → Klant (mirrors the
      // candidate's candidate_conversion, same UserCheck icon reads as "conversion").
      { id: 'customer_conversion', icon: UserCheck, component: CustomerConversionSettings },
      // Tenant-wide default for the customer's vacancy-visibility flags (Danny 27-07) —
      // VacancySettingsTab (customer drawer) reads these same keys for comparison.
      { id: 'customer_vacancy_defaults', icon: EyeOff, schema: customerVacancyDefaults },
    ],
  },
  {
    // Contactpersonen — own top-level group (Danny 2026-07-20, FUNCTIONS-SPLIT-1):
    // the contact function list split off from candidate functions, plus the
    // contact status lookup relocated from `customers` (component unchanged, only
    // its registry spot moves) so contact-specific settings live in one place.
    key: 'contacts', icon: Users,
    items: [
      { id: 'contact_functions', icon: Briefcase, component: ContactFunctionsSettings },
      { id: 'contact_statuses', icon: Users, component: ContactStatusesSettings },
    ],
  },
  {
    // Opportunity (Kans) settings — display preferences (euro vs hours). The stage /
    // service / agreement lookup editors move here in a later round.
    key: 'opportunities', icon: Target,
    items: [
      // Opportunity pipeline lookups (audit finding OPP-LOOKUPS-1) — stage/service/
      // agreement/deal-type lists previously had no editor at all.
      { id: 'opportunity_lookups', icon: ListTree, component: OpportunityLookupsSettings },
      { id: 'opportunity_display', icon: Palette, schema: opportunityDisplay },
    ],
  },
  {
    // WITHHELD (offered-iff-read registry rule, mirrors the note_types/document_types
    // comments above): the backend ships full tenant CRUD + reorder for
    // vacancy_employment_types (VacancyEmploymentTypeController extends LookupController,
    // routes/api/tenant/vacancies.php) — a value/label vocabulary for a vacancy's
    // employment type (permanent/temp/…). There is ZERO frontend consumer today:
    // MatchTemplatesSettings.jsx explicitly rejected wiring its own employment-type
    // filter to this single-value lookup in favour of a different multi-select, the
    // vacancy create/edit forms and VacancyDetailResource's employment_type field
    // still carry the FREE-TEXT column, and no picker anywhere reads
    // `/vacancy-employment-types`. Per §3 (no fake affordances) this does NOT get a
    // settings screen yet — a tenant would curate a vocabulary nothing ever applies.
    // No tenant data is at risk: the endpoint keeps serving vacancy_employment_types,
    // and re-adding a `vacancy_employment_types` item becomes a one-line change the
    // day a real vacancy-employment-type picker/reader lands (ticket VAC-EMPLOYMENT-1).
    key: 'vacancies', icon: Briefcase,
    items: [
      { id: 'vacancy_statuses', icon: Briefcase, component: VacancyStatusSettings },
      // VACSTATUS-DEFAULT-1: which status a status-less vacancy create gets
      // (backend VacancyDefaultStatusResolver) — same UserCheck icon as the
      // candidate/customer conversion pickers, reads as "the same concept".
      { id: 'vacancy_default_status', icon: UserCheck, component: VacancyDefaultStatusSettings },
      { id: 'vacancy_phases', icon: Target, component: VacancyPhaseSettings },
      { id: 'vacancy_seniority', icon: BarChart2, component: VacancySenioritySettings },
      { id: 'vacancy_education', icon: BookOpen, component: VacancyEducationSettings },
      { id: 'vacancy_channels', icon: Store, component: VacancyChannelSettings },
      // Vacancy custom fields moved to the shared "Eigen velden" group below.
      { id: 'vacancy_app_defaults', icon: ClipboardList, component: VacancyApplicationDefaultsSettings },
      { id: 'vacancy_matching', icon: Sparkles, component: VacancyMatchingSettings },
      // Kandidaten zoeken-tab visibility + filter defaults (Danny 23-07): mirrors
      // candidate_vacancy_tab — see VacancyCandidateTabSettings + candidateTabVisibility.ts.
      { id: 'vacancy_candidate_tab', icon: Users, component: VacancyCandidateTabSettings },
      // Matchprofielen (MATCH-TEMPLATE-1) — reusable named weight presets the vacancy
      // Matching tab's picker reads (read-only there); managed here.
      { id: 'match_templates', icon: SlidersHorizontal, component: MatchTemplatesSettings },
      { id: 'vacancy_display', icon: Palette, schema: vacancyDisplay },
    ],
  },
  {
    // Task (activity) lookups — own top-level menu, one sub-tab per list (decision §3B).
    key: 'tasks', icon: ListChecks,
    items: [
      { id: 'task_statuses', icon: ListChecks, component: TaskStatusSettings },
      { id: 'task_types', icon: Tags, component: TaskTypeSettings },
      { id: 'task_priorities', icon: Flag, component: TaskPrioritySettings },
      { id: 'task_display', icon: Palette, schema: taskDisplay },
    ],
  },
  {
    // Match lookups — statuses for the Matches feature (R-1; BE /match-statuses).
    key: 'matches', icon: Sparkles,
    items: [
      { id: 'match_statuses', icon: Tags, component: MatchStatusSettings },
      { id: 'contract_types', icon: FileText, component: ContractTypesSettings },
      // Match stop reasons (audit finding, 04-08) — MatchStopReasonSettings was fully
      // built + tested in MatchSettings.jsx but never wired into the registry, so the
      // mandatory reason recorded on POST /matches/{id}/terminate (MATCH-TERMINATE-1)
      // had no settings screen at all.
      { id: 'match_stop_reasons', icon: XCircle, component: MatchStopReasonSettings },
      // Appointment types/locations moved OUT to their own top-level `appointments`
      // group below (Danny 2026-08-04) — appointments span every entity, not just
      // matches, mirrors note_types/document_types.
      // Purchase→sale conversion factor (Danny 22-07) — moved here from Vacancies →
      // Matching: it's a match rate concept, not a per-vacancy one.
      { id: 'match_rates', icon: Percent, component: MatchRatesSettings },
      { id: 'match_display', icon: Palette, schema: matchDisplay },
    ],
  },
  {
    // Outreach (call-list / bellijsten) lookups (R-1; BE /outreach-statuses).
    key: 'outreach', icon: Phone,
    items: [
      { id: 'outreach_statuses', icon: Tags, component: OutreachStatusSettings },
      // Outreach outcomes (OUTREACH-2, round-4 audit finding #6) — the RESULT of one
      // call attempt, a separate dimension from the pipeline status above.
      // OutreachOutcomeSettings was fully built + tested (OutreachOutcomeSettings.test.jsx)
      // but never registered here, so the /outreach-outcomes lookup had no editor at all.
      { id: 'outreach_outcomes', icon: CheckCircle, component: OutreachOutcomeSettings },
      // Escalation reason lookup (audit finding ESCALATION-REASON-1) — call-list
      // escalation had no tenant-managed reason vocabulary.
      { id: 'escalation_reasons', icon: AlertTriangle, component: EscalationReasonsSettings },
      { id: 'outreach_display', icon: Palette, schema: outreachDisplay },
    ],
  },
  {
    // Eigen velden (§3B custom-fields wave, 2026-07-14) — ONE shared CRUD editor
    // (CustomFieldsSettings, parameterized by entityType) with a sub-tab per
    // entity, replacing the old per-entity forks (candidate_custom_fields,
    // vacancy_fields). Mirrors every other group here: one `render` per item so
    // the shell's existing sub-tab strip (SettingsTabs) does the rest — no new
    // nested tab bar needed for this to read as "one menu, one sub-tab per entity".
    key: 'custom_fields', icon: ListChecks,
    items: [
      { id: 'cf_candidate', icon: Users, render: () => <CustomFieldsSettings entityType="candidate" /> },
      { id: 'cf_application', icon: ClipboardList, render: () => <CustomFieldsSettings entityType="application" /> },
      { id: 'cf_match', icon: Sparkles, render: () => <CustomFieldsSettings entityType="match" /> },
      { id: 'cf_vacancy', icon: Briefcase, render: () => <CustomFieldsSettings entityType="vacancy" /> },
      { id: 'cf_task', icon: ListChecks, render: () => <CustomFieldsSettings entityType="task" /> },
      { id: 'cf_opportunity', icon: Target, render: () => <CustomFieldsSettings entityType="opportunity" /> },
      { id: 'cf_outreach_campaign', icon: Phone, render: () => <CustomFieldsSettings entityType="outreach_campaign" /> },
      { id: 'cf_customer', icon: Building2, render: () => <CustomFieldsSettings entityType="customer" /> },
      { id: 'cf_customer_location', icon: MapPin, render: () => <CustomFieldsSettings entityType="customer_location" /> },
      { id: 'cf_customer_department', icon: Building2, render: () => <CustomFieldsSettings entityType="customer_department" /> },
      { id: 'cf_customer_contact', icon: Users, render: () => <CustomFieldsSettings entityType="customer_contact" /> },
    ],
  },
  {
    // Notitietypes (NOTE-TYPES-2/3, Danny "ieder zijn eigen" 2026-07-20) — own top-level
    // group, one NoteTypesSettings(entity) sub-tab per entity that actually READS the
    // lookup, mirroring the custom_fields group above: one shared editor parameterized
    // by `entity`, never a per-entity fork. Replaces the old flat cross-entity list that
    // lived under personalisation.
    //
    // ONLY entities with a real reader get a tab (§3 no fake affordances, 2026-07-31).
    // A sub-tab here is offered iff some screen calls useNoteTypes(<entity>). Re-measured
    // 2026-08-04 against Danny's full wish list (klant/locatie/afdeling/contactpersoon/
    // taken/vacatures/sollicitaties/bellijsten/matches) — per-entity result:
    //   • candidate, application, customer, opportunity — unchanged, offered since wave 2.
    //   • contact   — NOW offered. CustomerNotesTab already called useNoteTypes('contact')
    //                 (the composer switches scope the moment a note is linked to a
    //                 contactpersoon, CONTACT-NOTITIES-1) — only the settings tab was
    //                 missing; the reader was real all along.
    //   • vacancy   — NOW offered. VacancyNoteController validates `type` against the
    //                 entity-scoped lookup since VACANCY-NOTE-TYPE-1 (2026-08-02), and the
    //                 vacancy drawer's Notes tab (pages/vacancies/drawer/NotesTab.tsx) was
    //                 rewritten onto the shared SharedNotesTab + useNoteTypes('vacancy') —
    //                 same picker/chip treatment as applications/opportunities.
    //   • match     — NOW offered (NT-MATCH-1, 2026-08-04). MatchDrawer grew a Notities
    //                 tab (pages/matches/drawer/NotesTab.tsx on the shared SharedNotesTab +
    //                 useNoteTypes('match')) against MatchNoteController's entity-scoped
    //                 `type` validation — the reader is real, so the editor turns on.
    //   • task      — NOW offered (NT-TASK-1, 2026-08-04). The Reacties tab (removed
    //                 2026-07-14) returned as a Notities tab on the shared SharedNotesTab +
    //                 useNoteTypes('task') against TaskCommentController's entity-scoped
    //                 `type` validation — Danny's note-type coverage list asked for it.
    //   • call_list (bellijsten) — STILL withheld, one step earlier than match/task: no
    //                 'call_list' token in the backend's NoteType::ENTITIES, no notes route
    //                 on outreach-campaigns, and no FE notes surface on OutreachDrawer either.
    //                 This is a backend-first gap (schema + controller + route), not just a
    //                 missing FE tab — see the worklist row.
    //   • location / department — deliberately NEVER get their own tab. Their notes are
    //                 CustomerNote rows (CustomerLocationController::notes / Customer
    //                 DepartmentController::notes just filter by location/department id) and
    //                 CustomerController::addNote validates `type` against entity=customer
    //                 (or entity=contact when customer_contact_id is filled) regardless of
    //                 which level the note is linked to — there is no separate location/
    //                 department scope to configure. nt_customer already covers them.
    // No tenant data is deleted for a withheld entity: the rows stay in note_types and the
    // endpoint keeps serving them, so re-adding one line here restores the editor the day
    // that entity grows a real FE reader.
    key: 'note_types', icon: MessageSquare,
    items: [
      { id: 'nt_candidate', icon: Users, render: () => <NoteTypesSettings entity="candidate" /> },
      { id: 'nt_application', icon: ClipboardList, render: () => <NoteTypesSettings entity="application" /> },
      { id: 'nt_customer', icon: Building2, render: () => <NoteTypesSettings entity="customer" /> },
      { id: 'nt_contact', icon: Users, render: () => <NoteTypesSettings entity="contact" /> },
      { id: 'nt_opportunity', icon: Target, render: () => <NoteTypesSettings entity="opportunity" /> },
      { id: 'nt_vacancy', icon: Briefcase, render: () => <NoteTypesSettings entity="vacancy" /> },
      { id: 'nt_match', icon: Sparkles, render: () => <NoteTypesSettings entity="match" /> },
      { id: 'nt_task', icon: ListChecks, render: () => <NoteTypesSettings entity="task" /> },
    ],
  },
  {
    // Document types (DOCTYPE-ENTITY-1, mirrors the note_types group above) — own
    // top-level group, one DocumentTypesSettings(entity) sub-tab per entity.
    // Replaces the old candidate-only `document_types` entry (a bespoke multi-tab
    // wrapper with its own internal SubTabBar + a "Global row" cross-entity fallback):
    // the backend's `?entity=` scope is now STRICT (mirrors NoteTypeController::
    // scopeIndex() exactly, no orWhereNull fallback), so that protection was guarding
    // a behaviour the backend no longer serves — see DocumentTypesSettings.jsx.
    //
    // ONLY entities with a real reader get a tab (§3 no fake affordances, mirrors
    // the note_types group's "offered-iff-read" rule; guarded by
    // registry.deadScreens.test.jsx). Re-measured 2026-08-05 against the backend's
    // full CandidateDocumentType::ENTITIES list (kandidaat/klant/locatie/afdeling/
    // contactpersoon/kans/taak/bellijst/match/vacature) — per-entity result:
    //   • candidate, customer — real readers since the wave that built this group
    //                 (candidate/customer DocumentsTab.tsx both call useDocumentTypes(entity)).
    //   • customer_location, customer_department — NOW offered (DOCTYPE-SCOPE-1,
    //                 2026-08-05). ScopedDocumentsTab used to hand the customer's
    //                 DocumentsTab no scope at all, so a location/department upload
    //                 silently read the CUSTOMER's document-type lookup — it now
    //                 passes its own docTypeScope ('customer_location'/
    //                 'customer_department') through to useDocumentTypes(), a real,
    //                 distinct reader per level.
    //   • vacancy   — NOW offered (DOCTYPE-VACANCY-1, 2026-08-05). The vacancy
    //                 drawer's DocumentsTab.tsx used to upload with a hardcoded
    //                 empty `type` — it now reads useDocumentTypes('vacancy') for a
    //                 real type picker + row chip, same treatment as candidate/customer.
    //   • contact   — STILL withheld. `customer_documents` has no
    //                 `customer_contact_id` column at all (measured:
    //                 EntityDocumentController::store/update only validate
    //                 customer_location_id/customer_department_id) — there is no
    //                 contact-level document concept to scope a lookup to yet.
    //   • opportunity, task, call_list, match — STILL withheld. No entity-scoped
    //                 documents route exists for any of them (no
    //                 /opportunities/{id}/documents, /tasks/{id}/documents,
    //                 /outreach-campaigns/{id}/documents or /matches/{id}/documents),
    //                 so no FE tab reads a document-type lookup scoped to them —
    //                 a backend-first gap, not just a missing FE tab.
    // No tenant data is deleted for a withheld entity: the rows stay in
    // document_types and the endpoint keeps serving them, so re-adding one line here
    // restores the editor the day that entity grows a real FE reader.
    key: 'document_types', icon: FileText,
    items: [
      { id: 'dt_candidate', icon: Users, render: () => <DocumentTypesSettings entity="candidate" /> },
      { id: 'dt_customer', icon: Building2, render: () => <DocumentTypesSettings entity="customer" /> },
      { id: 'dt_customer_location', icon: MapPin, render: () => <DocumentTypesSettings entity="customer_location" /> },
      { id: 'dt_customer_department', icon: Building2, render: () => <DocumentTypesSettings entity="customer_department" /> },
      { id: 'dt_vacancy', icon: Briefcase, render: () => <DocumentTypesSettings entity="vacancy" /> },
    ],
  },
  {
    // Appointments — own top-level group (Danny 2026-08-04): appointment types and
    // locations moved out of `matches` because appointments span every entity
    // (candidate intakes, customer visits, …), not just the Matches feature —
    // mirrors the note_types/document_types "spans every entity" moves above.
    key: 'appointments', icon: CalendarCheck,
    items: [
      { id: 'appointment_types', icon: CalendarCheck, component: AppointmentTypeSettings },
      { id: 'appointment_locations', icon: MapPin, component: AppointmentLocationSettings },
    ],
  },
  {
    // Actieregels (AXIS-MATRIX-2) — the tenant-editable action×condition matrix behind
    // every guarded write, spanning both the candidate and customer domains (§B/§C).
    // Its own top-level group per SETTINGS-CLEAN-1 (other rule-ish settings — conversion
    // default status, required fields per phase, guard behaviour — consolidate here next).
    key: 'action_rules', icon: Scale,
    items: [
      { id: 'action_rules', icon: Scale, component: ActionRulesSettings },
    ],
  },
  {
    // Workflow run-history retention (WF-RUN-PRUNE-1, Danny 05-08): a tenant-level
    // pruning window for completed workflow runs. Its own top-level group — not
    // "AI-flavoured" (the `ai` group), not the superadmin central job queue, and
    // not roles/users, so it doesn't fit any existing category (mirrors the
    // action_rules single-item-group precedent above). Gated on the 'workflows'
    // page/module (mirrors 'whatsapp'/'shiftmanager' below) — a tenant without the
    // workflows module has nothing to retain, so the group auto-hides for them.
    key: 'workflows', icon: History,
    items: [
      { id: 'workflow_run_history', icon: History, schema: workflowRunHistory, requiresPage: 'workflows' },
    ],
  },
  // Planning lookups — each item gated on the 'plan' module (requiresPage → canAccessPage →
  // hasModule('plan')). All 4 filtered out when off → the whole group drops (super-admins too).
  {
    key: 'planning', icon: CalendarDays,
    items: [
      { id: 'shift_types', icon: Clock, component: ShiftTypesSettings, requiresPage: 'planning' },
      { id: 'availability', icon: CalendarCheck, component: AvailabilitySettings, requiresPage: 'planning' },
      { id: 'automatch', icon: Sparkles, component: AutoMatchSettings, requiresPage: 'planning' },
      { id: 'planning_board', icon: LayoutGrid, component: PlanningBoardSettings, requiresPage: 'planning' },
    ],
  },
  {
    // A ViewConfigEditor sub-tab is offered ONLY for a module some screen actually
    // renders through <ModuleView> (§3 no fake affordances, 2026-07-31). Today the
    // single renderer is CustomersReport ("customers"); the planning/sales/candidates
    // editors saved `view.planning` / `view.sales` / `view.candidates` that nothing
    // ever read, so a tenant toggling blocks there got nothing, silently. They are NOT
    // offered. No tenant data is deleted: any saved `view.<module>` key stays in the
    // settings blob, and adding a <ModuleView module="planning"/> to a real dashboard
    // is what earns the tab back (the block catalogue is still in moduleRegistry.ts).
    key: 'views', icon: BarChart2,
    items: [
      { id: 'dashboards', icon: BarChart2, component: DashboardsSettings },
      { id: 'view_customers', icon: Building2, render: () => <ViewConfigEditor module="customers" /> },
    ],
  },
  {
    // Communication = e-mail per context (clients / candidates / planning).
    //
    // WITHHELD (offered-iff-read registry rule, mirrors the note_types/document_types
    // comments above): the backend ships full tenant CRUD for message_purposes
    // (MSG-PURPOSE-1 — MessagePurposeController.php, "Settings → Communicatie" in its
    // own doc-block) — a value/label vocabulary for WHY a WhatsApp/e-mail message
    // exists (birthday, evaluation, interview, manual, …), validated on
    // POST /messages `purpose`. There is ZERO frontend consumer today: no manual
    // compose picker, no workflow send-step, no timeline badge reads it. Per §3 (no
    // fake affordances) this does NOT get a settings screen yet — a tenant would be
    // able to curate a vocabulary nothing ever applies. No tenant data is at risk:
    // the endpoint keeps serving message_purposes, and re-adding this item becomes a
    // one-line change the day a real `purpose` picker/reader lands on the message
    // compose or workflow send-step surface.
    key: 'communication', icon: Mail,
    items: [
      { id: 'email_klanten', icon: Mail, render: () => <EmailSettings context="klanten" /> },
      { id: 'email_kandidaten', icon: Mail, render: () => <EmailSettings context="kandidaten" /> },
      { id: 'email_planning', icon: Mail, render: () => <EmailSettings context="planning" /> },
      { id: 'email_log', icon: ClipboardList, component: EmailLog },
    ],
  },
  {
    // WhatsApp — connection + messaging (WhatsApp Business).
    key: 'whatsapp', icon: MessageCircle,
    items: [
      { id: 'whatsapp', icon: MessageCircle, component: WhatsAppSettings, requiresPage: 'whatsapp' },
      { id: 'whatsapp_log', icon: ClipboardList, component: WhatsAppLog },
      // Message-type classification (priority_type on whatsapp_send; queue ordering).
      { id: 'wa_message_types', icon: MessageCircle, component: WaMessageTypeSettings },
    ],
  },
  {
    // Notifications — its own menu (per context). NOTIF-KANDIDAAT-1 (api Notifier.php,
    // 2026-08-05): candidate.x / match.x / task.x now resolve through the same
    // TYPE_CONTEXT_MAP gate as application/vacancy/invoice, so they get the same rows.
    key: 'notifications', icon: Bell,
    items: [
      { id: 'notif_sollicitaties', icon: Bell, render: () => <NotificationsSettings context="sollicitaties" /> },
      { id: 'notif_vacatures', icon: Bell, render: () => <NotificationsSettings context="vacatures" /> },
      { id: 'notif_kandidaten', icon: Bell, render: () => <NotificationsSettings context="kandidaten" /> },
      { id: 'notif_matches', icon: Bell, render: () => <NotificationsSettings context="matches" /> },
      { id: 'notif_taken', icon: Bell, render: () => <NotificationsSettings context="taken" /> },
      { id: 'notif_facturering', icon: Bell, render: () => <NotificationsSettings context="facturering" /> },
      // 11-escalatie (3b): per stilstand-signaal an optional day-threshold + target (user/role).
      { id: 'notif_escalation', icon: Bell, component: EscalationSettings },
    ],
  },
  {
    key: 'integrations', icon: Store,
    items: [
      { id: 'apikeys', icon: Key, component: ApiKeysSettings },
      { id: 'webhooks', icon: Webhook, component: WebhooksSettings },
      // Facebook Leads (FB-LEADS-1) — per-tenant Leads-app credentials + webhook URL.
      { id: 'facebook_leads', icon: Megaphone, component: FacebookLeadsSettings },
    ],
  },
  {
    // Import & Export — their own menu (Danny 21-07): the two data-exchange screens
    // share one master-detail format and belong together, not scattered in Integraties.
    key: 'import_export', icon: Download,
    items: [
      { id: 'importeren', icon: Download, component: ImporterenSettings },
      { id: 'export', icon: Upload, component: ExportSettings },
    ],
  },
  {
    // Modules (Danny 2026-07-20): add-on module settings under the SAME name the
    // super-admin Modules tab uses ("Losse modules"). The group auto-hides when no
    // item passes its gate (SettingsPage drops empty groups) — so it only shows
    // with Shiftmanager-rapportage and/or HelloFlex on. The old app-only gate is
    // gone with the manual Sync tab (SYNC-RETIRE-1): module-only via requiresPage.
    // HelloFlex settings land here once its credentials flow ships (wacht Danny).
    key: 'modules', icon: Boxes,
    items: [
      { id: 'mod_shiftmanager', icon: BarChart2, component: ShiftmanagerModuleSettings, requiresPage: 'shiftmanager' },
    ],
  },
  {
    key: 'billing', icon: CreditCard,
    items: [
      // billing_pay (payment methods + auto top-up) dropped per Danny (R-1).
      { id: 'billing_usage', icon: BarChart2, component: GebruikSettings },
      { id: 'billing_invoices', icon: FileText, component: FacturenSettings },
    ],
  },
  {
    // Super Admin (super-admin-only): per-tenant package + add-ons, connectors, usage + task manager.
    key: 'superadmin', icon: Shield,
    items: [
      { id: 'modules', icon: Package, component: ModulesSettings, superAdminOnly: true },
      { id: 'apps', icon: AppWindow, component: AppsSettings, superAdminOnly: true },
      { id: 'usage', icon: BarChart2, component: TenantUsageSettings, superAdminOnly: true },
      // Taakbeheer (T4.1, extended QUEUE-VIEW-1) — queue/job health, backlog list, failure log.
      { id: 'admin_jobs', icon: ListChecks, component: JobQueueSettings, superAdminOnly: true },
    ],
  },
  {
    // Administration: roles and users only.
    key: 'administration', icon: Users,
    items: [
      { id: 'roles', icon: Shield, component: RolesSettings },
      { id: 'users', icon: Users, component: UsersPage },
    ],
  },
  {
    // Audit log: own top-level settings group so it is easy to find.
    key: 'audit', icon: ClipboardList,
    items: [
      { id: 'audit', icon: ClipboardList, component: AuditLog },
    ],
  },
]
