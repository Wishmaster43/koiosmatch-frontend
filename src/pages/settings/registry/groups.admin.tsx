// Settings registry — platform/admin groups: Integrations, Import & Export, Billing,
// Super Admin, Administration, Audit log. Extracted from registry.tsx (REGISTRY-SPLIT-1)
// in original array order; registry.tsx concatenates this with the other
// registry/groups.* modules to build NAV_GROUPS.
import {
  Store, BarChart2, Boxes, Globe, Key, Webhook, Megaphone, Gauge, Download, Upload,
  CreditCard, FileText, Shield, Package, AppWindow, Sparkles, ListChecks, Users,
  ShieldCheck, ClipboardList,
} from 'lucide-react'
import type { NavGroup } from './types'

import ShiftmanagerModuleSettings from '../sections/ShiftmanagerModuleSettings'
import HelloflexSettings from '../sections/integrations/HelloflexSettings'
import WerkzoekenSettings from '../sections/integrations/WerkzoekenSettings'
import ApiKeysSettings from '../sections/apikeys'
import WebhooksSettings from '../sections/webhooks'
import FacebookLeadsSettings from '../sections/FacebookLeadsSettings'
import TenantLimitsSettings from '../sections/integrations/TenantLimitsSettings'
import ImportSettings from '../sections/ImportSettings'
import ExportSettings from '../sections/ExportSettings'
import BillingUsageSettings from '../sections/BillingUsageSettings'
import TenantInvoicesSettings from '../sections/TenantInvoicesSettings'
import ModulesSettings from '../sections/ModulesSettings'
import AppsSettings from '../sections/AppsSettings'
import TenantUsageSettings from '../sections/TenantUsageSettings'
import AdminLimitsSettings from '../sections/AdminLimitsSettings'
import KoiosModelsAdminSettings from '../sections/KoiosModelsAdminSettings'
import JobQueueSettings from '../sections/jobs'
import InvoiceCompanySettings from '../sections/InvoiceCompanySettings'
import AdminInvoicesSettings from '../sections/AdminInvoicesSettings'
import RolesSettings from '../sections/RolesSettings'
import UsersPage from '@/pages/users/UsersPage'
import CatalogSection from '../sections/CatalogSection'
import AuditLog from '../sections/AuditLog'

// Integrations, Import & Export, Billing, Super Admin, Administration and Audit
// groups, in original NAV_GROUPS order.
export const adminGroups: NavGroup[] = [
  {
    key: 'integrations', icon: Store,
    items: [
      // INTEGRATIONS-SETTINGS-1 (Danny 31-08): each connector gets its own section
      // here — the former Modules-group screens move in unchanged (same gates,
      // same components); old deep-links resolve via SLUG_ALIASES. The Koppeling/
      // Mapping sub-tabs land with CMBE's contract, never as empty fakes (§3).
      { id: 'shiftmanager', icon: BarChart2, component: ShiftmanagerModuleSettings, requiresPage: 'shiftmanager' },
      { id: 'helloflex', icon: Boxes, component: HelloflexSettings, requiresPage: 'helloflex' },
      // Werkzoeken connector (INTEGRATIONS-CONTRACT §1) — gated on the new 'wz'
      // module via access.ts; v1 = the connection card only.
      { id: 'werkzoeken', icon: Globe, component: WerkzoekenSettings, requiresPage: 'werkzoeken' },
      { id: 'apikeys', icon: Key, component: ApiKeysSettings },
      { id: 'webhooks', icon: Webhook, component: WebhooksSettings },
      // Facebook Leads (FB-LEADS-1) — per-tenant Leads-app credentials + webhook URL.
      { id: 'facebook_leads', icon: Megaphone, component: FacebookLeadsSettings },
      // LIMIET-MONITOR-1: how many calls this tenant made per connector and which caps apply.
      { id: 'limits', icon: Gauge, component: TenantLimitsSettings },
    ],
  },
  {
    // Import & Export — their own menu (Danny 21-07): the two data-exchange screens
    // share one master-detail format and belong together, not scattered in Integraties.
    key: 'import_export', icon: Download,
    items: [
      { id: 'import', icon: Download, component: ImportSettings },
      { id: 'export', icon: Upload, component: ExportSettings },
    ],
  },
  {
    key: 'billing', icon: CreditCard,
    items: [
      // billing_pay (payment methods + auto top-up) dropped per Danny (R-1).
      // CREDITS-1: gated on the new `billing.view` permission — settings.view alone
      // is NOT enough (tenant_admin/admin/manager only); hidden, never disabled (§3).
      { id: 'billing_usage', icon: BarChart2, component: BillingUsageSettings, requiresPermission: 'billing.view' },
      { id: 'billing_invoices', icon: FileText, component: TenantInvoicesSettings, requiresPermission: 'billing.view' },
    ],
  },
  {
    // Super Admin (super-admin-only): per-tenant package + add-ons, connectors, usage + task manager.
    key: 'superadmin', icon: Shield,
    items: [
      { id: 'modules', icon: Package, component: ModulesSettings, superAdminOnly: true },
      { id: 'apps', icon: AppWindow, component: AppsSettings, superAdminOnly: true },
      { id: 'usage', icon: BarChart2, component: TenantUsageSettings, superAdminOnly: true },
      // LIMIET-MONITOR-1: platform-wide connector usage + tenants nearing their cap.
      { id: 'admin_limits', icon: Gauge, component: AdminLimitsSettings, superAdminOnly: true },
      // K-147 L1+L2: platform-wide Koios model registry — flavour→model map,
      // per-request-type routing, package flavour ceilings, tenant overrides.
      { id: 'koios_models', icon: Sparkles, component: KoiosModelsAdminSettings, superAdminOnly: true },
      // Taakbeheer (T4.1, extended QUEUE-VIEW-1) — queue/job health, backlog list, failure log.
      { id: 'admin_jobs', icon: ListChecks, component: JobQueueSettings, superAdminOnly: true },
      // INVOICE-1 (14-08): platform invoicing — seller details + numbering knobs,
      // then the per-month draft/final list with generate/finalize/re-send actions.
      { id: 'admin_invoice_settings', icon: FileText, component: InvoiceCompanySettings, superAdminOnly: true },
      { id: 'admin_invoices', icon: FileText, component: AdminInvoicesSettings, superAdminOnly: true },
    ],
  },
  {
    // Administration: roles and users only.
    key: 'administration', icon: Users,
    items: [
      { id: 'roles', icon: Shield, component: RolesSettings },
      { id: 'users', icon: Users, component: UsersPage },
      // CATALOG-EMBED-1 (Danny 13-09: must be part of every settings screen):
      // the catalogue's "retention" section, system group —
      // message/workflow-run/Koios-memory/AI-prompt-log retention windows, a
      // platform concern rather than any one entity's own screen.
      { id: 'system', icon: ShieldCheck, render: () => <CatalogSection section="retention" group="system" /> },
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
