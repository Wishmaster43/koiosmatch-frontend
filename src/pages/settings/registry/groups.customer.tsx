// Settings registry — customer-domain groups: Customers, Contacts, Opportunities.
// Extracted from registry.tsx (REGISTRY-SPLIT-1) in original array order; registry.tsx
// concatenates this with the other registry/groups.* modules to build NAV_GROUPS.
import {
  Building2, Target, Tags, Radio, ShieldOff, Scale, MapPin, Palette, Flag, Hash, UserCheck,
  EyeOff, Clock, Users, Briefcase, ListTree,
} from 'lucide-react'
import type { NavGroup } from './types'

import { CustomerStatusesSettings, CustomerPhasesSettings, LocationStatusesSettings, DepartmentStatusesSettings, ContactStatusesSettings } from '../sections/CustomerSettings'
import CustomerSourcesSettings from '../sections/customers/CustomerSourcesSettings'
import BlacklistReasonsSettings from '../sections/BlacklistReasonsSettings'
import CaoSettings from '../sections/CaoSettings'
import CustomerDisplaySettings from '../sections/CustomerDisplaySettings'
import CustomerRequiredFieldsSettings from '../sections/customers/CustomerRequiredFieldsSettings'
import IdentifierValidationSettings from '../sections/customers/IdentifierValidationSettings'
import { CustomerConversionSettings } from '../sections/CustomerConversionSettings'
import CatalogSection from '../sections/CatalogSection'
import ContactFunctionsSettings from '../sections/ContactFunctionsSettings'
import OpportunityLookupsSettings from '../sections/OpportunityLookupsSettings'
import customerVacancyDefaults from '../schemas/customerVacancyDefaults'
import opportunityDisplay from '../schemas/opportunityDisplay'

// Customers, Contacts and Opportunities groups, in original NAV_GROUPS order.
export const customerGroups: NavGroup[] = [
  {
    // Customer-domain lookups — statuses for the customer and its sub-entities.
    // contact_statuses moved out to its own `contacts` group below (Danny 2026-07-20,
    // FUNCTIONS-SPLIT-1) so every contact-person setting lives together.
    key: 'customers', icon: Building2,
    items: [
      // KLANT-FASE-1: lifecycle phase (Prospect → Klant) — same axis, same icon as the
      // candidate phase editor, so both read as "the same thing on another entity".
      { id: 'customer_phases', icon: Target, component: CustomerPhasesSettings, logName: 'customer_phases' },
      { id: 'customer_statuses', icon: Tags, component: CustomerStatusesSettings, logName: 'customer_statuses' },
      // CUST-SOURCE-FE-1: acquisition-source lookup mirroring application_sources
      // above — same Radio icon, so it reads as "the same thing on another entity".
      // NOT YET AUDITED (fixround F).
      { id: 'customer_sources', icon: Radio, component: CustomerSourcesSettings, logName: null },
      // Customer half of the blacklist-reason vocabulary (KLANT-BLACKLIST-1) — lives
      // HERE, not as a sub-tab under candidates (translated: "customer with
      // customer" — verbatim: "klant bij klant", Danny 2026-08-05).
      { id: 'customer_blacklist_reasons', icon: ShieldOff, render: () => <BlacklistReasonsSettings entity="customer" />, logName: 'customer_blacklist_reasons' },
      // CAO lookup — feeds price agreements + the + Match popup (Danny 24-07).
      { id: 'cao', icon: Scale, component: CaoSettings, logName: 'collective_labour_agreements' },
      { id: 'location_statuses', icon: MapPin, component: LocationStatusesSettings, logName: 'customer_location_statuses' },
      { id: 'department_statuses', icon: Building2, component: DepartmentStatusesSettings, logName: 'customer_department_statuses' },
      // SUB-TABS-1 (Danny 02-08): was a single flat schema; now a component so the
      // customer-table settings and the three drill-down entity tables (+ Vacatures'
      // default filter) each get their own sub-tab — see CustomerDisplaySettings.
      { id: 'customer_display', icon: Palette, component: CustomerDisplaySettings },
      // KLANT-VERPLICHT-1 (Danny 02-08): required fields per customer phase + the three
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
      // CATALOG-EMBED-1: the catalogue's "windows" section, customers group.
      { id: 'customer_windows', icon: Clock, render: () => <CatalogSection section="windows" group="customers" /> },
    ],
  },
  {
    // Contactpersonen — own top-level group (Danny 2026-07-20, FUNCTIONS-SPLIT-1):
    // the contact function list split off from candidate functions, plus the
    // contact status lookup relocated from `customers` (component unchanged, only
    // its registry spot moves) so contact-specific settings live in one place.
    key: 'contacts', icon: Users,
    items: [
      { id: 'contact_functions', icon: Briefcase, component: ContactFunctionsSettings, logName: 'contact_functions' },
      { id: 'contact_statuses', icon: Users, component: ContactStatusesSettings, logName: 'customer_contact_statuses' },
      // CATALOG-EMBED-1: the catalogue's "windows" section, contacts group.
      { id: 'contact_windows', icon: Clock, render: () => <CatalogSection section="windows" group="contacts" /> },
    ],
  },
  {
    // Opportunity (Kans) settings — display preferences (euro vs hours). The stage /
    // service / agreement lookup editors move here in a later round.
    key: 'opportunities', icon: Target,
    items: [
      // Opportunity pipeline lookups (audit finding OPP-LOOKUPS-1) — stage/service/
      // agreement/deal-type lists previously had no editor at all. Multi-tab section
      // edits five lookup tables (opportunity_stages, opportunity_service_types,
      // opportunity_agreement_types, opportunity_deal_types, opportunity_lost_reasons);
      // null logName disables the changelog until this component supports querying
      // per-tab audit logs (each tab would need its own logName parameter).
      { id: 'opportunity_lookups', icon: ListTree, component: OpportunityLookupsSettings, logName: null },
      { id: 'opportunity_display', icon: Palette, schema: opportunityDisplay },
      // CATALOG-EMBED-1 host for windows/opportunities — first rows shipped with KPI-BUILDER-1 (BE 5e3c7a24).
      { id: 'opportunity_windows', icon: Clock, render: () => <CatalogSection section="windows" group="opportunities" /> },
    ],
  },
]
