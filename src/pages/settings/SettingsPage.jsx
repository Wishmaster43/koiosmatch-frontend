/**
 * SettingsPage — the settings area: a registry-driven left-hand nav (NAV_GROUPS)
 * that renders the active section. Each nav item carries its own component/render.
 *
 * Every section is a loose component in ./sections/*.jsx; shared bits live in
 * ./lib/settingsApi.js and ./components/SettingsControls.jsx. Add a setting =
 * one section file + one registry entry. All labels come from the `settings` i18n ns.
 */
import { useState, useEffect } from 'react'
import { AppWindow, BarChart2, Bell, BookOpen, Briefcase, Building2, ClipboardList, Clock, CreditCard, Download, FileText, Key, LayoutDashboard, Lock, Mail, MapPin, MessageCircle, Package, Palette, RotateCcw, Shield, Store, Tags, Target, Users, Webhook, XCircle, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import UsersPage from '../users/UsersPage'
import { useAuth } from '../../context/AuthContext'
import { canAccessPage } from '../../lib/access'
import ViewConfigEditor from '../../components/settings/ViewConfigEditor'
import KpiSettings from './sections/KpiSettings'
import DisplaySettings from './sections/DisplaySettings'
import BrandSettings from './sections/BrandSettings'
import CompanySettings from './sections/CompanySettings'
import LocationsSettings from './sections/LocationsSettings'
import MemorySettings from './sections/MemorySettings'
import CandidateLookupsSettings from './sections/CandidateLookupsSettings'
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
import ApiKeysSettings from './sections/ApiKeysSettings'
import AppStoreSettings from './sections/AppStoreSettings'
import NotificationsSettings from './sections/NotificationsSettings'
import { PlanbeheerSettings, BetaalmethodenSettings, AutoOpwaarderenSettings, GebruikSettings, FacturenSettings } from './sections/BillingSettings'


const NAV_GROUPS = [
  {
    key: 'general',
    items: [
      { id: 'kpis',     label: 'KPIs',     icon: Target,          component: KpiSettings },
      { id: 'display',  label: 'Display',  icon: LayoutDashboard, component: DisplaySettings },
      { id: 'branding', label: 'Brand',    icon: Palette,         component: BrandSettings },
      { id: 'security', label: 'Security', icon: Lock,            component: SecuritySettings },
    ],
  },
  {
    key: 'company',
    items: [
      { id: 'company',   label: 'General',   icon: Building2, component: CompanySettings },
      { id: 'locations', label: 'Locations', icon: MapPin,    component: LocationsSettings },
    ],
  },
  {
    key: 'personalisation',
    items: [
      { id: 'memory',           label: 'Memory',            icon: BookOpen,  component: MemorySettings },
      { id: 'candidate_lookups',label: 'Candidate lookups', icon: Tags,      component: CandidateLookupsSettings },
      { id: 'vacancy',          label: 'Vacancy',           icon: Briefcase, component: VacancySettings },
      { id: 'rejection',        label: 'Rejection reasons', icon: XCircle,   component: RejectionSettings },
      { id: 'cv_template',      label: 'CV template',       icon: FileText,  component: CvTemplateSettings },
    ],
  },
  {
    key: 'views',
    items: [
      { id: 'view_customers',  label: 'Customers',  icon: Building2, render: () => <ViewConfigEditor module="customers" /> },
      { id: 'view_planning',   label: 'Planning',   icon: Clock,     render: () => <ViewConfigEditor module="planning" /> },
      { id: 'view_sales',      label: 'Sales',      icon: BarChart2, render: () => <ViewConfigEditor module="sales" /> },
      { id: 'view_candidates', label: 'Candidates', icon: Users,     render: () => <ViewConfigEditor module="candidates" /> },
    ],
  },
  {
    key: 'notifications',
    items: [
      { id: 'notif_sollicitaties', label: 'Applications', icon: Bell, render: () => <NotificationsSettings context="sollicitaties" /> },
      { id: 'notif_vacatures',     label: 'Vacancies',    icon: Bell, render: () => <NotificationsSettings context="vacatures" /> },
      { id: 'notif_facturering',   label: 'Billing',      icon: Bell, render: () => <NotificationsSettings context="facturering" /> },
    ],
  },
  {
    key: 'communication',
    items: [
      { id: 'email',    label: 'Email',    icon: Mail,          component: EmailSettings },
      { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, component: WhatsAppSettings, requiresPage: 'whatsapp' },
    ],
  },
  {
    key: 'integrations',
    items: [
      { id: 'appstore',   label: 'App store', icon: Store,    component: AppStoreSettings },
      { id: 'apikeys',    label: 'API keys',  icon: Key,      component: ApiKeysSettings },
      { id: 'webhooks',   label: 'Webhooks',  icon: Webhook,  component: WebhooksSettings },
      { id: 'importeren', label: 'Import',    icon: Download, component: ImporterenSettings },
    ],
  },
  {
    key: 'billing',
    items: [
      { id: 'billing_plans',    label: 'Plan',            icon: CreditCard, component: PlanbeheerSettings },
      { id: 'billing_pay',      label: 'Payment methods', icon: CreditCard, component: BetaalmethodenSettings },
      { id: 'billing_auto',     label: 'Auto top-up',     icon: Zap,        component: AutoOpwaarderenSettings },
      { id: 'billing_usage',    label: 'Usage',           icon: BarChart2,  component: GebruikSettings },
      { id: 'billing_invoices', label: 'Invoices',        icon: FileText,   component: FacturenSettings },
    ],
  },
  {
    key: 'administration',
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

export default function SettingsPage() {
  const auth = useAuth()
  const { isSuperAdmin } = auth
  const { t } = useTranslation('settings')

  // Filter tabs:
  //  - `superAdminOnly` tabs (Modules) are hidden for everyone except super admins
  //  - `users` tab is a gated page (accessible_pages)
  const visibleGroups = NAV_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(it => {
        if (it.superAdminOnly && !isSuperAdmin()) return false
        if (it.requiresPage && !canAccessPage(it.requiresPage, auth)) return false
        if (it.id === 'users' && !canAccessPage('users', auth)) return false
        return true
      }),
    }))
    .filter(group => group.items.length > 0)
  const visibleTabs = visibleGroups.flatMap(g => g.items)

  const [tab, setTab] = useState(() => visibleTabs[0]?.id ?? null)

  // If the active tab is not (or no longer) visible for this role, fall back to the first one.
  useEffect(() => {
    if (!visibleTabs.some(t => t.id === tab)) setTab(visibleTabs[0]?.id ?? null)
  }, [visibleTabs.map(t => t.id).join(','), tab])

  const current = visibleTabs.find(t => t.id === tab)

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>

      {/* Left nav — only the groups/sections this role may see */}
      <div style={{
        width: 220, flexShrink: 0, borderRight: '1px solid #F3F4F6',
        background: 'white', overflowY: 'auto', padding: '20px 10px',
      }}>
        <div style={{ paddingLeft: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{t('shell.title')}</div>
        </div>

        {visibleGroups.map(group => (
          <div key={group.key} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#C4C4CF', letterSpacing: '0.08em',
                          textTransform: 'uppercase', padding: '0 8px', marginBottom: 4 }}>
              {t(`groups.${group.key}`)}
            </div>
            {group.items.map(item => {
              const Icon   = item.icon
              const active = tab === item.id
              return (
                <button key={item.id} onClick={() => setTab(item.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                    padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: active ? 600 : 400, textAlign: 'left',
                    background: active ? 'var(--color-primary-bg)' : 'transparent',
                    color:      active ? 'var(--color-primary)'    : '#374151',
                    transition: 'all 0.12s', marginBottom: 1,
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F9FAFB' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <Icon size={14} style={{ flexShrink: 0,
                    color: active ? 'var(--color-primary)' : '#9CA3AF' }} />
                  {t(`nav.${item.id}`)}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 32, minWidth: 0 }}>
        {/* Empty state when the role has no visible sections at all */}
        {!current && (
          <div className="flex items-center justify-center" style={{ height: '60%' }}>
            <p className="text-sm text-gray-400">{t('shell.empty')}</p>
          </div>
        )}

        {/* Registry-driven: each nav item carries its own component/render. */}
        {current && (current.render ? current.render() : current.component ? <current.component /> : null)}
      </div>
    </div>
  )
}
