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
  ClipboardList, Clock, CreditCard, Download, Factory, FileText, Flag, Hash, Key, LayoutGrid,
  ListChecks, Mail, MapPin, MessageCircle, MessageSquare, Languages, Megaphone, Package, Palette, Phone, Scale, Shield, SlidersHorizontal, Sparkles, Star,
  Boxes, Store, Tags, Target, Upload, UserCheck, Users, Webhook, XCircle,
} from 'lucide-react'
import CustomFieldsSettings from './sections/CustomFieldsSettings'
import VacancyGenerationSettings from './sections/VacancyGenerationSettings'

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
import { CustomerStatusesSettings, LocationStatusesSettings, DepartmentStatusesSettings, ContactStatusesSettings } from './sections/CustomerSettings'
import PoolsSettings from './sections/PoolsSettings'
import { LanguageListSettings, LanguageLevelSettings } from './sections/LanguageSettings'
import GenderSettings from './sections/GenderSettings'
import IndustrySettings from './sections/IndustrySettings'
import FunctionsSettings from './sections/FunctionsSettings'
import ContactFunctionsSettings from './sections/ContactFunctionsSettings'
import { VacancyStatusSettings, VacancyPhaseSettings, VacancySenioritySettings, VacancyEducationSettings, VacancyChannelSettings, VacancyApplicationDefaultsSettings } from './sections/VacancySettings'
import VacancyMatchingSettings from './sections/VacancyMatchingSettings'
import MatchTemplatesSettings from './sections/MatchTemplatesSettings'
import { TaskStatusSettings, TaskTypeSettings, TaskPrioritySettings } from './sections/TaskSettings'
import { MatchStatusSettings } from './sections/MatchSettings'
import { AppointmentTypeSettings } from './sections/AppointmentTypeSettings'
import { AppointmentLocationSettings } from './sections/AppointmentLocationSettings'
import { SkillLevelSettings } from './sections/SkillLevelSettings'
import { OutreachStatusSettings } from './sections/OutreachSettings'
import RejectionSettings from './sections/RejectionSettings'
import CandidateRequiredFieldsSettings from './sections/CandidateRequiredFieldsSettings'
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
// Planning settings — gated on the 'plan' module (requiresPage: 'planning'); hidden until it is on.
import { ShiftTypesSettings, AvailabilitySettings, AutoMatchSettings, PlanningBoardSettings } from './sections/PlanningSettings'
import { FacturenSettings } from './sections/BillingSettings'
import GebruikSettings from './sections/GebruikSettings'

import {
  kpisLeads, kpisCandidates, kpisApplications, kpisCustomers, kpisLocations,
  kpisDepartments, kpisContacts, kpisTasks, kpisCalllists, kpisMatches,
} from './schemas/kpis'
import candidateDisplay from './schemas/candidateDisplay'
import customerDisplay from './schemas/customerDisplay'
import taskDisplay from './schemas/taskDisplay'
import applicationDisplay from './schemas/applicationDisplay'
import opportunityDisplay from './schemas/opportunityDisplay'
import vacancyDisplay from './schemas/vacancyDisplay'
import matchDisplay from './schemas/matchDisplay'
import outreachDisplay from './schemas/outreachDisplay'
import DriverLicenseSettings from './sections/DriverLicenseSettings'
import ActionRulesSettings from './sections/ActionRulesSettings'

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
      { id: 'memory', icon: BookOpen, component: MemorySettings },
      { id: 'locations', icon: MapPin, component: LocationsSettings },
      { id: 'branding', icon: Palette, component: BrandSettings },
      // NUMMER-1: prefix/padding/start per entity for the human-readable reference numbers.
      { id: 'numbering', icon: Hash, component: NumberingSettings },
    ],
  },
  {
    // AI-driven content — its own top-level group (VACGEN-1 fase 1): sits near the other
    // AI-flavoured settings (Koios under integrations, Geheugen under company) but gets a
    // dedicated home since it is a distinct, growing CRUD surface (generation profiles +
    // reusable content blocks), mirroring note_types/action_rules getting their own group.
    key: 'ai', icon: Sparkles,
    items: [
      { id: 'koios', icon: Sparkles, component: KoiosSettings },
      { id: 'vacancy_generation', icon: Sparkles, component: VacancyGenerationSettings },
    ],
  },
  {
    // Personalisation = shared/general tenant lookups (used across candidates, customers, contacts, …).
    key: 'personalisation', icon: BookOpen,
    items: [
      { id: 'industries', icon: Factory, component: IndustrySettings },
      { id: 'functions', icon: Briefcase, component: FunctionsSettings },
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
      { id: 'candidate_phases', icon: Target, component: CandidatePhasesSettings },
      { id: 'candidate_statuses', icon: Users, component: CandidateStatusesSettings },
      { id: 'contract_forms', icon: Tags, component: ContractFormsSettings },
      { id: 'pools', icon: Star, component: PoolsSettings },
      { id: 'cv_template', icon: FileText, component: CvTemplateSettings },
      { id: 'document_types', icon: FileText, component: DocumentTypesSettings },
      { id: 'driver_licenses', icon: Car, component: DriverLicenseSettings },
      { id: 'candidate_display', icon: Palette, schema: candidateDisplay },
      // Conversion behaviour: default deployability status after Lead → Kandidaat.
      { id: 'candidate_conversion', icon: UserCheck, component: CandidateConversionSettings },
      { id: 'candidate_skill_levels', icon: BarChart2, component: SkillLevelSettings },
      // Candidate custom fields moved to the shared "Eigen velden" group below
      // (§3B custom-fields wave) — one CRUD implementation for every entity.
      { id: 'candidate_required_fields', icon: Flag, component: CandidateRequiredFieldsSettings },
    ],
  },
  {
    // Application (sollicitatie) lookups — funnel stages + rejection reasons live on the
    // application, not the candidate (Danny). Rejection messaging is handled by workflows.
    key: 'applications', icon: ClipboardList,
    items: [
      { id: 'funnel_stages', icon: Target, component: FunnelStagesSettings },
      { id: 'rejection', icon: XCircle, component: RejectionSettings },
      { id: 'application_display', icon: Palette, schema: applicationDisplay },
    ],
  },
  {
    // Customer-domain lookups — statuses for the customer and its sub-entities.
    // contact_statuses moved out to its own `contacts` group below (Danny 2026-07-20,
    // FUNCTIONS-SPLIT-1) so every contact-person setting lives together.
    key: 'customers', icon: Building2,
    items: [
      { id: 'customer_statuses', icon: Tags, component: CustomerStatusesSettings },
      { id: 'location_statuses', icon: MapPin, component: LocationStatusesSettings },
      { id: 'department_statuses', icon: Building2, component: DepartmentStatusesSettings },
      { id: 'customer_display', icon: Palette, schema: customerDisplay },
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
      { id: 'opportunity_display', icon: Palette, schema: opportunityDisplay },
    ],
  },
  {
    key: 'vacancies', icon: Briefcase,
    items: [
      { id: 'vacancy_statuses', icon: Briefcase, component: VacancyStatusSettings },
      { id: 'vacancy_phases', icon: Target, component: VacancyPhaseSettings },
      { id: 'vacancy_seniority', icon: BarChart2, component: VacancySenioritySettings },
      { id: 'vacancy_education', icon: BookOpen, component: VacancyEducationSettings },
      { id: 'vacancy_channels', icon: Store, component: VacancyChannelSettings },
      // Vacancy custom fields moved to the shared "Eigen velden" group below.
      { id: 'vacancy_app_defaults', icon: ClipboardList, component: VacancyApplicationDefaultsSettings },
      { id: 'vacancy_matching', icon: Sparkles, component: VacancyMatchingSettings },
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
      { id: 'appointment_types', icon: CalendarCheck, component: AppointmentTypeSettings },
      { id: 'appointment_locations', icon: MapPin, component: AppointmentLocationSettings },
      { id: 'match_display', icon: Palette, schema: matchDisplay },
    ],
  },
  {
    // Outreach (call-list / bellijsten) lookups (R-1; BE /outreach-statuses).
    key: 'outreach', icon: Phone,
    items: [
      { id: 'outreach_statuses', icon: Tags, component: OutreachStatusSettings },
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
    // group, one NoteTypesSettings(entity) sub-tab per backend NoteType::ENTITIES value,
    // mirroring the custom_fields group above: one shared editor parameterized by
    // `entity`, never a per-entity fork. Replaces the old flat cross-entity list that
    // lived under personalisation.
    key: 'note_types', icon: MessageSquare,
    items: [
      { id: 'nt_candidate', icon: Users, render: () => <NoteTypesSettings entity="candidate" /> },
      { id: 'nt_application', icon: ClipboardList, render: () => <NoteTypesSettings entity="application" /> },
      { id: 'nt_match', icon: Sparkles, render: () => <NoteTypesSettings entity="match" /> },
      { id: 'nt_task', icon: ListChecks, render: () => <NoteTypesSettings entity="task" /> },
      { id: 'nt_customer', icon: Building2, render: () => <NoteTypesSettings entity="customer" /> },
      { id: 'nt_contact', icon: Users, render: () => <NoteTypesSettings entity="contact" /> },
      { id: 'nt_opportunity', icon: Target, render: () => <NoteTypesSettings entity="opportunity" /> },
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
    key: 'views', icon: BarChart2,
    items: [
      { id: 'dashboards', icon: BarChart2, component: DashboardsSettings },
      { id: 'view_customers', icon: Building2, render: () => <ViewConfigEditor module="customers" /> },
      { id: 'view_planning', icon: Clock, render: () => <ViewConfigEditor module="planning" /> },
      { id: 'view_sales', icon: BarChart2, render: () => <ViewConfigEditor module="sales" /> },
      { id: 'view_candidates', icon: Users, render: () => <ViewConfigEditor module="candidates" /> },
    ],
  },
  {
    // Communication = e-mail per context (clients / candidates / planning).
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
    // Notifications — its own menu (per context).
    key: 'notifications', icon: Bell,
    items: [
      { id: 'notif_sollicitaties', icon: Bell, render: () => <NotificationsSettings context="sollicitaties" /> },
      { id: 'notif_vacatures', icon: Bell, render: () => <NotificationsSettings context="vacatures" /> },
      { id: 'notif_facturering', icon: Bell, render: () => <NotificationsSettings context="facturering" /> },
    ],
  },
  {
    key: 'integrations', icon: Store,
    items: [
      { id: 'apikeys', icon: Key, component: ApiKeysSettings },
      { id: 'webhooks', icon: Webhook, component: WebhooksSettings },
      { id: 'importeren', icon: Download, component: ImporterenSettings },
      // Exporteren (EXPORT-CSV-1) — mirrors the Importeren item right above it.
      { id: 'export', icon: Upload, component: ExportSettings },
      // Facebook Leads (FB-LEADS-1) — per-tenant Leads-app credentials + webhook URL.
      { id: 'facebook_leads', icon: Megaphone, component: FacebookLeadsSettings },
    ],
  },
  {
    // Modules (Danny 2026-07-20): add-on module settings under the SAME name the
    // super-admin Modules tab uses ("Losse modules"). The group auto-hides when no
    // item passes its gate (SettingsPage drops empty groups) — so it only shows
    // with ShiftManager-rapportage and/or HelloFlex on. The old app-only gate is
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
