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
  AppWindow, BarChart2, Bell, BookOpen, Briefcase, Building2, Car,
  ClipboardList, Clock, CreditCard, Download, Factory, FileText, Flag, Key,
  ListChecks, Mail, MapPin, MessageCircle, MessageSquare, Languages, Package, Palette, Shield, Sparkles, Star,
  Store, Tags, Target, Users, Webhook, XCircle,
} from 'lucide-react'

import UsersPage from '../users/UsersPage'
import ViewConfigEditor from '@/components/settings/ViewConfigEditor'

import BrandSettings from './sections/BrandSettings'
import CompanySettings from './sections/CompanySettings'
import LocationsSettings from './sections/LocationsSettings'
import MemorySettings from './sections/MemorySettings'
import { ContractFormsSettings, FunnelStagesSettings, CandidateStatusesSettings, CandidatePhasesSettings } from './sections/CandidateLookupsSettings'
import { LastContactTypesSettings, NoteTypesSettings } from './sections/CandidateCommSettings'
import { CustomerStatusesSettings, LocationStatusesSettings, DepartmentStatusesSettings, ContactStatusesSettings } from './sections/CustomerSettings'
import PoolsSettings from './sections/PoolsSettings'
import { LanguageListSettings, LanguageLevelSettings } from './sections/LanguageSettings'
import GenderSettings from './sections/GenderSettings'
import IndustrySettings from './sections/IndustrySettings'
import { VacancyStatusSettings, VacancyPhaseSettings, VacancyFieldsSettings, VacancyEmploymentTypeSettings, VacancySenioritySettings, VacancyEducationSettings, VacancyChannelSettings } from './sections/VacancySettings'
import VacancyMatchingSettings from './sections/VacancyMatchingSettings'
import { TaskStatusSettings, TaskTypeSettings, TaskPrioritySettings } from './sections/TaskSettings'
import RejectionSettings from './sections/RejectionSettings'
import CandidateCustomFieldsSettings from './sections/CandidateCustomFieldsSettings'
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
import WhatsAppSettings from './sections/WhatsAppSettings'
import ImporterenSettings from './sections/ImporterenSettings'
import ApiKeysSettings from './sections/apikeys'
import MessagingSettings from './sections/messaging'
import KoiosSettings from './sections/koios'
import NotificationsSettings from './sections/NotificationsSettings'
// Planning tijdelijk verborgen (2026-06-26): import { ShiftTypesSettings, AvailabilitySettings, AutoMatchSettings, PlanningBoardSettings } from './sections/PlanningSettings'
import { BetaalmethodenSettings, AutoOpwaarderenSettings, GebruikSettings, FacturenSettings } from './sections/BillingSettings'

import { kpisLeads, kpisCandidates, kpisApplications, kpisCustomers } from './schemas/kpis'
import candidateDisplay from './schemas/candidateDisplay'
import DriverLicenseSettings from './sections/DriverLicenseSettings'

export const NAV_GROUPS = [
  {
    key: 'kpis', icon: Target,
    items: [
      // Sub-tabs per KPI area; labels via nav.<id>, fields share the `kpis.*` i18n.
      { id: 'kpis_leads',        label: 'Leads KPIs',       icon: Target,        schema: kpisLeads },
      { id: 'kpis_candidates',   label: 'Candidate KPIs',   icon: Users,         schema: kpisCandidates },
      { id: 'kpis_applications', label: 'Application KPIs', icon: ClipboardList, schema: kpisApplications },
      { id: 'kpis_customers',    label: 'Customer KPIs',    icon: Building2,      schema: kpisCustomers },
    ],
  },
  {
    // Company / organisation: profile, locations, brand + per-module view config.
    key: 'company', icon: Building2,
    items: [
      { id: 'company',   label: 'General',   icon: Building2, component: CompanySettings },
      { id: 'memory',    label: 'Memory',    icon: BookOpen,  component: MemorySettings },
      { id: 'locations', label: 'Locations', icon: MapPin,    component: LocationsSettings },
      { id: 'branding',  label: 'Brand',     icon: Palette,   component: BrandSettings },
    ],
  },
  {
    // Personalisation = shared/general tenant lookups (used across candidates, customers, contacts, …).
    key: 'personalisation', icon: BookOpen,
    items: [
      { id: 'industries',         label: 'Industries',   icon: Factory,       component: IndustrySettings },
      { id: 'lang_languages',     label: 'Languages',    icon: Languages,     component: LanguageListSettings },
      { id: 'lang_levels',        label: 'Levels',       icon: BarChart2,     component: LanguageLevelSettings },
      { id: 'genders',            label: 'Gender',       icon: Users,         component: GenderSettings },
      { id: 'last_contact_types', label: 'Contact type', icon: MessageCircle, component: LastContactTypesSettings },
      { id: 'note_types',         label: 'Note types',   icon: MessageSquare, component: NoteTypesSettings },
    ],
  },
  {
    // Candidate-specific settings (Danny: "Kandidaat").
    key: 'candidate', icon: Users,
    items: [
      { id: 'candidate_phases',       label: 'Phase',             icon: Target,        component: CandidatePhasesSettings },
      { id: 'candidate_statuses',     label: 'Status',            icon: Users,         component: CandidateStatusesSettings },
      { id: 'contract_forms',         label: 'Contractvorm',      icon: Tags,          component: ContractFormsSettings },
      { id: 'pools',                  label: 'Talent pools',      icon: Star,          component: PoolsSettings },
      { id: 'cv_template',            label: 'CV template',       icon: FileText,      component: CvTemplateSettings },
      { id: 'document_types',         label: 'Document types',    icon: FileText,      component: DocumentTypesSettings },
      { id: 'driver_licenses',        label: 'Driving licences',  icon: Car,           component: DriverLicenseSettings },
      { id: 'candidate_display',      label: 'Table display',     icon: Palette,       schema: candidateDisplay },
      { id: 'candidate_custom_fields', label: 'Custom fields',    icon: ListChecks,    component: CandidateCustomFieldsSettings },
      { id: 'candidate_required_fields', label: 'Required fields', icon: Flag,         component: CandidateRequiredFieldsSettings },
    ],
  },
  {
    // Application (sollicitatie) lookups — funnel stages + rejection reasons live on the
    // application, not the candidate (Danny). Rejection messaging is handled by workflows.
    key: 'applications', icon: ClipboardList,
    items: [
      { id: 'funnel_stages', label: 'Funnel stages',     icon: Target,  component: FunnelStagesSettings },
      { id: 'rejection',     label: 'Rejection reasons', icon: XCircle, component: RejectionSettings },
    ],
  },
  {
    // Customer-domain lookups — statuses for the customer and its sub-entities.
    key: 'customers', icon: Building2,
    items: [
      { id: 'customer_statuses',   label: 'Statuses',          icon: Tags,      component: CustomerStatusesSettings },
      { id: 'location_statuses',   label: 'Location statuses',  icon: MapPin,    component: LocationStatusesSettings },
      { id: 'department_statuses', label: 'Department statuses', icon: Building2, component: DepartmentStatusesSettings },
      { id: 'contact_statuses',    label: 'Contact statuses',   icon: Users,     component: ContactStatusesSettings },
    ],
  },
  {
    key: 'vacancies', icon: Briefcase,
    items: [
      { id: 'vacancy_statuses',    label: 'Statuses',         icon: Briefcase,      component: VacancyStatusSettings },
      { id: 'vacancy_phases',      label: 'Phases',           icon: Target,         component: VacancyPhaseSettings },
      { id: 'vacancy_employment',  label: 'Employment types', icon: ClipboardList,  component: VacancyEmploymentTypeSettings },
      { id: 'vacancy_seniority',   label: 'Seniority',        icon: BarChart2,      component: VacancySenioritySettings },
      { id: 'vacancy_education',   label: 'Education',        icon: BookOpen,       component: VacancyEducationSettings },
      { id: 'vacancy_channels',    label: 'Job boards',       icon: Store,          component: VacancyChannelSettings },
      { id: 'vacancy_fields',      label: 'Custom fields',    icon: FileText,       component: VacancyFieldsSettings },
      { id: 'vacancy_matching',    label: 'Matching',         icon: Sparkles,       component: VacancyMatchingSettings },
    ],
  },
  {
    // Task (activity) lookups — own top-level menu, one sub-tab per list (decision §3B).
    key: 'tasks', icon: ListChecks,
    items: [
      { id: 'task_statuses',   label: 'Statuses',       icon: ListChecks, component: TaskStatusSettings },
      { id: 'task_types',      label: 'Activity types', icon: Tags,       component: TaskTypeSettings },
      { id: 'task_priorities', label: 'Priorities',     icon: Flag,       component: TaskPrioritySettings },
    ],
  },
  // Planning tijdelijk verborgen (2026-06-26) — niet verwijderd, alleen uit. Terugzetten = dit blok +
  // de PlanningSettings-import + de CalendarDays/LayoutGrid-iconen weer activeren.
  /*
  {
    key: 'planning', icon: CalendarDays,
    items: [
      { id: 'shift_types',     label: 'Shift types',     icon: Clock,         component: ShiftTypesSettings },
      { id: 'availability',    label: 'Availability',    icon: CalendarCheck, component: AvailabilitySettings },
      { id: 'automatch',       label: 'Auto-match rules', icon: Sparkles,     component: AutoMatchSettings },
      { id: 'planning_board',  label: 'Planning board',  icon: LayoutGrid,    component: PlanningBoardSettings },
    ],
  },
  */
  {
    key: 'views', icon: BarChart2,
    items: [
      { id: 'view_customers',  label: 'Customers',  icon: Building2, render: () => <ViewConfigEditor module="customers" /> },
      { id: 'view_planning',   label: 'Planning',   icon: Clock,     render: () => <ViewConfigEditor module="planning" /> },
      { id: 'view_sales',      label: 'Sales',      icon: BarChart2, render: () => <ViewConfigEditor module="sales" /> },
      { id: 'view_candidates', label: 'Candidates', icon: Users,     render: () => <ViewConfigEditor module="candidates" /> },
    ],
  },
  {
    // Communication = e-mail per context (clients / candidates / planning).
    key: 'communication', icon: Mail,
    items: [
      { id: 'email_klanten',    label: 'Email — clients',    icon: Mail, render: () => <EmailSettings context="klanten" /> },
      { id: 'email_kandidaten', label: 'Email — candidates', icon: Mail, render: () => <EmailSettings context="kandidaten" /> },
      { id: 'email_planning',   label: 'Email — planning',   icon: Mail, render: () => <EmailSettings context="planning" /> },
    ],
  },
  {
    // WhatsApp — connection + messaging (WhatsApp Business).
    key: 'whatsapp', icon: MessageCircle,
    items: [
      { id: 'whatsapp',  label: 'WhatsApp',  icon: MessageCircle, component: WhatsAppSettings, requiresPage: 'whatsapp' },
      { id: 'messaging', label: 'Messages',  icon: MessageSquare, component: MessagingSettings },
    ],
  },
  {
    // Notifications — its own menu (per context).
    key: 'notifications', icon: Bell,
    items: [
      { id: 'notif_sollicitaties', label: 'Applications', icon: Bell, render: () => <NotificationsSettings context="sollicitaties" /> },
      { id: 'notif_vacatures',     label: 'Vacancies',    icon: Bell, render: () => <NotificationsSettings context="vacatures" /> },
      { id: 'notif_facturering',   label: 'Billing',      icon: Bell, render: () => <NotificationsSettings context="facturering" /> },
    ],
  },
  {
    key: 'integrations', icon: Store,
    items: [
      { id: 'mod_shiftmanager', label: 'Shiftmanager', icon: BarChart2, component: ShiftmanagerModuleSettings, requiresPage: 'shiftmanager' },
      { id: 'apikeys',    label: 'API keys',  icon: Key,      component: ApiKeysSettings },
      { id: 'webhooks',   label: 'Webhooks',  icon: Webhook,  component: WebhooksSettings },
      { id: 'importeren', label: 'Import',    icon: Download, component: ImporterenSettings },
      { id: 'koios',      label: 'Koios AI',  icon: Sparkles, component: KoiosSettings },
    ],
  },
  {
    key: 'billing', icon: CreditCard,
    items: [
      // Payment methods + auto top-up merged into one tab; the standalone Plan tab dropped (Danny).
      { id: 'billing_pay', label: 'Payment', icon: CreditCard, render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          <BetaalmethodenSettings />
          <AutoOpwaarderenSettings />
        </div>
      ) },
      { id: 'billing_usage',    label: 'Usage',    icon: BarChart2, component: GebruikSettings },
      { id: 'billing_invoices', label: 'Invoices', icon: FileText,  component: FacturenSettings },
    ],
  },
  {
    // Super Admin (super-admin-only): per-tenant package + add-ons, connectors, and usage.
    key: 'superadmin', icon: Shield,
    items: [
      { id: 'modules', label: 'Package',           icon: Package,   component: ModulesSettings,    superAdminOnly: true },
      { id: 'apps',    label: 'Apps (connectors)', icon: AppWindow, component: AppsSettings,        superAdminOnly: true },
      { id: 'usage',   label: 'Usage',             icon: BarChart2, component: TenantUsageSettings, superAdminOnly: true },
    ],
  },
  {
    // Administration: roles and users only.
    key: 'administration', icon: Users,
    items: [
      { id: 'roles', label: 'Roles & permissions', icon: Shield, component: RolesSettings },
      { id: 'users', label: 'Users',               icon: Users,  component: UsersPage },
    ],
  },
  {
    // Audit log: own top-level settings group so it is easy to find.
    key: 'audit', icon: ClipboardList,
    items: [
      { id: 'audit', label: 'Audit log', icon: ClipboardList, component: AuditLog },
    ],
  },
]
