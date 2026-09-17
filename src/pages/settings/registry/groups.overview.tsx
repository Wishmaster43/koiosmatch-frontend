// Settings registry — overview domain groups: KPIs, Company, Koios AI, Personalisation.
// Extracted from registry.tsx (REGISTRY-SPLIT-1) in original array order; registry.tsx
// concatenates this with the other registry/groups.* modules to build NAV_GROUPS.
import {
  Target, Users, ClipboardList, Building2, MapPin, ListChecks, Phone, Sparkles, Briefcase,
  Palette, Hash, Shield, Globe, BookOpen, MessageSquare, Clock, Scale, Languages, BarChart2,
  MessageCircle, Factory, Wrench,
} from 'lucide-react'
import type { NavGroup } from './types'

import CompanySettings from '../sections/CompanySettings'
import LocationsSettings from '../sections/LocationsSettings'
import BrandSettings from '../sections/BrandSettings'
import NumberingSettings from '../sections/NumberingSettings'
import OrganisationPolicySettings from '../sections/OrganisationPolicySettings'
import CareerSiteSettings from '../sections/CareerSiteSettings'
import KoiosSettings from '../sections/koios'
import MemorySettings from '../sections/MemorySettings'
import VacancyGenerationSettings from '../sections/VacancyGenerationSettings'
import KoiosAdviceSettings from '../sections/KoiosAdviceSettings'
import AiTransparencySettings from '../sections/AiTransparencySettings'
import InterviewSettings from '../sections/InterviewSettings'
import JargonSettings from '../sections/JargonSettings'
import IndustrySettings from '../sections/IndustrySettings'
import ProvincesSettings from '../sections/ProvincesSettings'
import { LanguageListSettings, LanguageLevelSettings } from '../sections/LanguageSettings'
import GenderSettings from '../sections/GenderSettings'
import { LastContactTypesSettings } from '../sections/CandidateCommSettings'
// KNOWLEDGE-BASE-1 (Danny 09-09, row 22: "Waar is interne FAQ en interne kennisbank …"): the
// two AI-management tabs are reachable from Settings → Koios AI as well; the internal/
// external scope arrives with the BE contract.
import { FAQTab, KnowledgeTab } from '@/components/ai/AIManagementTabs'

import {
  kpisLeads, kpisCandidates, kpisApplications, kpisCustomers, kpisLocations,
  kpisDepartments, kpisContacts, kpisTasks, kpisCalllists, kpisMatches,
  kpisOpportunities, kpisVacancies,
} from '../schemas/kpis'
import KpiBuilderSettings from '../sections/kpiBuilder/KpiBuilderSettings'

// KPIs, Company, Koios AI and Personalisation groups, in original NAV_GROUPS order.
export const overviewGroups: NavGroup[] = [
  {
    key: 'kpis', icon: Target,
    items: [
      // KPI-BUILDER-FE-1: tenant-defined KPI cards (own metric/target/unit) per
      // entity, first in the group. `kpi_definitions` is not one of the audited
      // tables in AUDIT-LOG-NAMES.md, hence logName: null (registry.logNames guard).
      { id: 'kpi_builder', icon: Wrench, component: KpiBuilderSettings, requiresPage: 'reports', logName: null },
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
      // KPI-DREMPELS-FE-1: pipeline/vacancy day-window thresholds, shared with reports.
      { id: 'kpis_opportunities', icon: Target, schema: kpisOpportunities },
      { id: 'kpis_vacancies', icon: Briefcase, schema: kpisVacancies },
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
      // Knowledge base + FAQ (row 22): the agents draw from these next to their own prompt.
      { id: 'knowledge', icon: BookOpen, render: () => <KnowledgeTab /> },
      { id: 'faq', icon: MessageSquare, render: () => <FAQTab /> },
      // AF:orphans-7-6 — vacancy-generation creation is gated on 'vacancy_generation.manage' permission.
      { id: 'vacancy_generation', icon: Sparkles, component: VacancyGenerationSettings, requiresPermission: 'vacancy_generation.manage' },
      // Koios advice thresholds (old open Danny item): the stale-vacancy and
      // match-renewal day windows behind the "Koios" attention column on the
      // vacancies/matches tables — cross-entity Koios-rule config, so it sits
      // here rather than forcing a fit into either entity's display schema.
      { id: 'koios_advice', icon: Clock, component: KoiosAdviceSettings },
      // AI-Act transparency (X-32): principles, human oversight, tenant posture, active features.
      { id: 'ai_transparency', icon: Scale, component: AiTransparencySettings },
      // AI-interview configuration (X-12): rejection mode, booking link, recruiter phone.
      { id: 'interview', icon: MessageSquare, component: InterviewSettings },
      // Tenant jargon list (K-155): terms the AI correction prompt uses to fix
      // dictated abbreviations (e.g. "bfv" -> "BHV") in notes/assist results.
      { id: 'jargon', icon: Languages, component: JargonSettings },
    ],
  },
  {
    // Personalisation = shared/general tenant lookups (used across candidates, customers, contacts, …).
    key: 'personalisation', icon: BookOpen,
    items: [
      { id: 'industries', icon: Factory, component: IndustrySettings, logName: 'industries' },
      // Regions per country (PROVINCES-1) — tenant CRUD + reorder, cascaded on the
      // address country picker; sits next to Industries as a shared lookup.
      { id: 'provinces', icon: MapPin, component: ProvincesSettings, logName: 'provinces' },
      { id: 'lang_languages', icon: Languages, component: LanguageListSettings, logName: 'languages' },
      { id: 'lang_levels', icon: BarChart2, component: LanguageLevelSettings, logName: 'language_levels' },
      { id: 'genders', icon: Users, component: GenderSettings, logName: 'candidate_genders' },
      { id: 'last_contact_types', icon: MessageCircle, component: LastContactTypesSettings, logName: 'last_contact_types' },
    ],
  },
]
