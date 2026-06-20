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
  AppWindow, BarChart2, Bell, BookOpen, Briefcase, Building2, CalendarCheck, CalendarDays,
  ClipboardList, Clock, CreditCard, Download, Factory, FileText, Key, LayoutDashboard, LayoutGrid, Lock,
  Mail, MapPin, MessageCircle, Languages, Package, Palette, RotateCcw, Shield, Sparkles, Star,
  Store, Tags, Target, Users, Webhook, XCircle, Zap,
} from 'lucide-react'

import UsersPage from '../users/UsersPage'
import ViewConfigEditor from '../../components/settings/ViewConfigEditor'

import BrandSettings from './sections/BrandSettings'
import CompanySettings from './sections/CompanySettings'
import LocationsSettings from './sections/LocationsSettings'
import MemorySettings from './sections/MemorySettings'
import CandidateLookupsSettings from './sections/CandidateLookupsSettings'
import PoolsSettings from './sections/PoolsSettings'
import LanguageSettings from './sections/LanguageSettings'
import GenderSettings from './sections/GenderSettings'
import IndustrySettings from './sections/IndustrySettings'
import VacancySettings from './sections/VacancySettings'
import RejectionSettings from './sections/RejectionSettings'
import CvTemplateSettings from './sections/CvTemplateSettings'
import SecuritySettings from './sections/SecuritySettings'
import EmailSettings from './sections/EmailSettings'
import AuditLog from './sections/AuditLog'
import RolesSettings from './sections/RolesSettings'
import SyncSettings from './sections/SyncSettings'
import WebhooksSettings from './sections/WebhooksSettings'
import AppsSettings from './sections/AppsSettings'
import ModulesSettings from './sections/ModulesSettings'
import WhatsAppSettings from './sections/WhatsAppSettings'
import ImporterenSettings from './sections/ImporterenSettings'
import ApiKeysSettings from './sections/apikeys'
import AppStoreSettings from './sections/AppStoreSettings'
import NotificationsSettings from './sections/NotificationsSettings'
import { ShiftTypesSettings, AvailabilitySettings, AutoMatchSettings, PlanningBoardSettings } from './sections/PlanningSettings'
import { PlanbeheerSettings, BetaalmethodenSettings, AutoOpwaarderenSettings, GebruikSettings, FacturenSettings } from './sections/BillingSettings'

import kpisSchema from './schemas/kpis'
import displaySchema from './schemas/display'

export const NAV_GROUPS = [
  {
    key: 'general', icon: LayoutDashboard,
    items: [
      { id: 'kpis',     label: 'KPIs',     icon: Target,  schema: kpisSchema },
      { id: 'display',  label: 'Display',  icon: BarChart2, schema: displaySchema },
      { id: 'branding', label: 'Brand',    icon: Palette, component: BrandSettings },
      { id: 'security', label: 'Security', icon: Lock,    component: SecuritySettings },
    ],
  },
  {
    key: 'company', icon: Building2,
    items: [
      { id: 'company',   label: 'General',   icon: Building2, component: CompanySettings },
      { id: 'locations', label: 'Locations', icon: MapPin,    component: LocationsSettings },
    ],
  },
  {
    key: 'personalisation', icon: BookOpen,
    items: [
      { id: 'memory',            label: 'Memory',            icon: BookOpen,  component: MemorySettings },
      { id: 'candidate_lookups', label: 'Candidate lookups', icon: Tags,      component: CandidateLookupsSettings },
      { id: 'pools',             label: 'Talent pools',      icon: Star,      component: PoolsSettings },
      { id: 'languages',         label: 'Languages',         icon: Languages, component: LanguageSettings },
      { id: 'genders',           label: 'Gender',            icon: Users,     component: GenderSettings },
      { id: 'industries',        label: 'Industries',        icon: Factory,   component: IndustrySettings },
      { id: 'vacancy',           label: 'Vacancy',           icon: Briefcase, component: VacancySettings },
      { id: 'rejection',         label: 'Rejection reasons', icon: XCircle,   component: RejectionSettings },
      { id: 'cv_template',       label: 'CV template',       icon: FileText,  component: CvTemplateSettings },
    ],
  },
  {
    key: 'planning', icon: CalendarDays,
    items: [
      { id: 'shift_types',     label: 'Shift types',     icon: Clock,         component: ShiftTypesSettings },
      { id: 'availability',    label: 'Availability',    icon: CalendarCheck, component: AvailabilitySettings },
      { id: 'automatch',       label: 'Auto-match rules', icon: Sparkles,     component: AutoMatchSettings },
      { id: 'planning_board',  label: 'Planning board',  icon: LayoutGrid,    component: PlanningBoardSettings },
    ],
  },
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
    key: 'notifications', icon: Bell,
    items: [
      { id: 'notif_sollicitaties', label: 'Applications', icon: Bell, render: () => <NotificationsSettings context="sollicitaties" /> },
      { id: 'notif_vacatures',     label: 'Vacancies',    icon: Bell, render: () => <NotificationsSettings context="vacatures" /> },
      { id: 'notif_facturering',   label: 'Billing',      icon: Bell, render: () => <NotificationsSettings context="facturering" /> },
    ],
  },
  {
    key: 'communication', icon: MessageCircle,
    items: [
      { id: 'email_klanten',    label: 'Email — clients',    icon: Mail, render: () => <EmailSettings context="klanten" /> },
      { id: 'email_kandidaten', label: 'Email — candidates', icon: Mail, render: () => <EmailSettings context="kandidaten" /> },
      { id: 'email_planning',   label: 'Email — planning',   icon: Mail, render: () => <EmailSettings context="planning" /> },
      { id: 'whatsapp',         label: 'WhatsApp',           icon: MessageCircle, component: WhatsAppSettings, requiresPage: 'whatsapp' },
    ],
  },
  {
    key: 'integrations', icon: Store,
    items: [
      { id: 'appstore',   label: 'App store', icon: Store,    component: AppStoreSettings },
      { id: 'apikeys',    label: 'API keys',  icon: Key,      component: ApiKeysSettings },
      { id: 'webhooks',   label: 'Webhooks',  icon: Webhook,  component: WebhooksSettings },
      { id: 'importeren', label: 'Import',    icon: Download, component: ImporterenSettings },
    ],
  },
  {
    key: 'billing', icon: CreditCard,
    items: [
      { id: 'billing_plans',    label: 'Plan',            icon: CreditCard, component: PlanbeheerSettings },
      { id: 'billing_pay',      label: 'Payment methods', icon: CreditCard, component: BetaalmethodenSettings },
      { id: 'billing_auto',     label: 'Auto top-up',     icon: Zap,        component: AutoOpwaarderenSettings },
      { id: 'billing_usage',    label: 'Usage',           icon: BarChart2,  component: GebruikSettings },
      { id: 'billing_invoices', label: 'Invoices',        icon: FileText,   component: FacturenSettings },
    ],
  },
  {
    key: 'administration', icon: Shield,
    items: [
      { id: 'modules', label: 'Modules',             icon: Package,       component: ModulesSettings, superAdminOnly: true },
      { id: 'apps',    label: 'Apps (connectors)',   icon: AppWindow,     component: AppsSettings,    superAdminOnly: true },
      { id: 'roles',   label: 'Roles & permissions', icon: Shield,        component: RolesSettings },
      { id: 'users',   label: 'Users',               icon: Users,         component: UsersPage },
      { id: 'sync',    label: 'Synchronisation',     icon: RotateCcw,     component: SyncSettings },
      { id: 'audit',   label: 'Audit log',           icon: ClipboardList, component: AuditLog },
    ],
  },
]
