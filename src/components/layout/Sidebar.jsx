/**
 * Sidebar — the left navigation rail.
 * Renders the brand, a TenantSwitcher (super admins can change tenant), and the
 * nav items that set the active page. Collapses to icons when `expanded` is false.
 *
 * TenantSwitcher below = the tenant dropdown shown at the top of the sidebar.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { canAccessPage } from '@/lib/access'
import TenantSwitcher from './TenantSwitcher'
import {
  LayoutDashboard, Users, Building2,
  MessageCircle, Settings, ChevronDown, Brain, BarChart3, TrendingUp, BrainCircuit,
  FileText, Briefcase, Handshake, ListChecks, Target, PieChart, PhoneCall, CalendarDays,
} from 'lucide-react'

// Resolve a nav item's label from i18n by id (dots → underscores to stay flat).
const navLabel = (t, id) => t(`nav.${id.replace(/\./g, '_')}`)

// Koios entitlement (cosmetic only — the backend still enforces 403). Fail-open:
// hide the toggle only when the auth payload explicitly excludes the `koios_ai`
// module or the `koios.use` permission, mirroring the "absence = open" convention
// in lib/access.js so Koios isn't hidden before the payload carries these.
function canUseKoios(auth) {
  if (auth?.isSuperAdmin?.()) return true
  const mods = (auth?.activeTenant ?? auth?.user?.tenant)?.modules
  const moduleOk = !Array.isArray(mods) ||
    mods.some(m => (typeof m === 'string' ? m : m?.key ?? m?.name) === 'koios_ai')
  const perms = auth?.user?.permissions
  const permOk = !Array.isArray(perms) ||
    perms.some(p => (typeof p === 'string' ? p : p?.name) === 'koios.use')
  return moduleOk && permOk
}

// Regular top-level pages. Gated entries (see lib/access.js) are filtered by
// accessible_pages below. Planning, AI & Workflows and WhatsApp live here too
// (moved up out of "Modules"); they stay gated per page via accessible_pages.
const NAV_ITEMS = [
  { id: 'dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
  { id: 'candidates',     label: 'Kandidaten',     icon: Users },
  { id: 'applications',   label: 'Sollicitaties',  icon: FileText },
  { id: 'vacancies',      label: 'Vacatures',      icon: Briefcase },
  { id: 'matches',        label: 'Matches',        icon: Handshake },
  { id: 'opportunities',  label: 'Kansen',         icon: Target },
  { id: 'tasks',          label: 'Taken',          icon: ListChecks },
  { id: 'outreach',       label: 'Bellijsten',     icon: PhoneCall },
  { id: 'customers',      label: 'Klanten',        icon: Building2 },
  { id: 'planning',       label: 'Planning',       icon: CalendarDays },
  { id: 'aiagents',       label: 'AI & Workflows', icon: Brain },
  { id: 'whatsapp',       label: 'WhatsApp',       icon: MessageCircle },
  // Reports hub — LAST standard item, right above the MODULES group (Danny 2026-07-05).
  // Gated on the "Rapporten Koios Match" add-on (access.ts). Children map to
  // ReportsPage tabs; labels resolve via common.nav.* (navLabel).
  {
    id: 'reports', label: 'Rapporten', icon: PieChart,
    children: [
      { id: 'reports.flow',       label: 'Flow' },
      { id: 'reports.recruiters', label: 'Recruiters' },
      { id: 'reports.vacancies',  label: 'Vacatures' },
      { id: 'reports.matches',    label: 'Matches' },
    ],
  },
]

// Module pages — shown in a separate "Modules" nav group. All are gated by
// accessible_pages (super admin enables them per tenant via the Modules settings tab).
const MODULE_NAV_ITEMS = [
  {
    id: 'shiftmanager', label: 'Shiftmanager', icon: BarChart3,
    children: [
      // Rapporten (analytics)
      { id: 'shiftmanager.dashboard',        label: 'Dashboard' },
      { id: 'shiftmanager.customers',        label: 'Klanten-SM' },
      { id: 'shiftmanager.locations',        label: 'Locaties-SM' },
      { id: 'shiftmanager.departments',      label: 'Afdelingen-SM' },
      { id: 'shiftmanager.candidates',       label: 'Kandidaten-SM' },
      { id: 'shiftmanager.candidate-shifts', label: 'Kandidaten-Shifts' },
      // Tabellen (operationele data)
      { id: 'shiftmanager.customers-table',   label: 'Klanten' },
      { id: 'shiftmanager.locations-table',   label: 'Locaties' },
      { id: 'shiftmanager.departments-table', label: 'Afdelingen' },
      { id: 'shiftmanager.candidates-table',  label: 'Kandidaten' },
      { id: 'shiftmanager.contacts-table',    label: 'Contactpersonen' },
      { id: 'shiftmanager.orders-table',      label: 'Diensten' },
      // Communicatie / AI (los, module-gated)
      { id: 'shiftmanager.runs-table',        label: 'Uitvoeringen' },
      { id: 'shiftmanager.details',           label: 'WhatsApp' },
    ],
  },
  {
    id: 'helloflex', label: 'HelloFlex', icon: TrendingUp,
    children: [
      { id: 'helloflex.dashboard', label: 'Dashboard-HF' },
    ],
  },
]

function SubNavItem({ item, active, onNavigate }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={() => onNavigate(item.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center w-full rounded-lg mb-0.5 border-none cursor-pointer font-sans transition-all duration-150"
      style={{
        gap: 8, padding: '6px 10px',
        background: active ? 'var(--color-primary-bg)' : hovered ? 'var(--sidebar-hover)' : 'transparent',
        color:      active ? 'var(--color-primary)'    : hovered ? 'var(--sidebar-text)'   : 'var(--sidebar-muted)',
      }}
    >
      <div className="flex-shrink-0 rounded-full"
        style={{ width: 4, height: 4, marginLeft: 2,
          background: active ? 'var(--color-primary)' : 'currentColor' }} />
      <span style={{ fontSize: 12, fontWeight: active ? 500 : 400 }}>{item.label}</span>
    </button>
  )
}

function NavItem({ item, activePage, expanded, openItems, toggleOpen, onNavigate }) {
  const { t } = useTranslation('common')
  const [hovered, setHovered] = useState(false)

  const hasChildren = !!item.children?.length
  const mainPage    = activePage?.split('.')[0]
  const isActive    = !hasChildren && mainPage === item.id
  const isOpen      = openItems.includes(item.id)
  const Icon        = item.icon

  const handleClick = () => {
    if (hasChildren) { toggleOpen(item.id); onNavigate(item.id) }
    else onNavigate(item.id)
  }

  return (
    <div>
      <button
        onClick={handleClick}
        title={!expanded ? item.label : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="flex items-center w-full rounded-lg mb-0.5 border-none cursor-pointer font-sans transition-all duration-150"
        style={{
          gap:            expanded ? 9 : 0,
          padding:        expanded ? '7px 10px' : '7px',
          justifyContent: expanded ? 'flex-start' : 'center',
          background: isActive ? 'var(--color-primary-bg)' : hovered ? 'var(--sidebar-hover)' : 'transparent',
          color:      isActive ? 'var(--color-primary)'    : hovered ? 'var(--sidebar-text)'   : 'var(--sidebar-muted)',
        }}
      >
        {Icon && <Icon size={15} style={{ flexShrink: 0 }} />}

        {expanded && (
          <>
            <span style={{ fontSize: 13, fontWeight: isActive ? 500 : 400, flex: 1, textAlign: 'left' }}>
              {item.label}
            </span>
            {item.soon && (
              <span style={{
                fontSize: 9, fontWeight: 600, letterSpacing: '0.04em', padding: '2px 5px',
                background: 'var(--hover-bg)', color: 'var(--text-muted)', borderRadius: 4, flexShrink: 0,
              }}>
                {t('comingSoon')}
              </span>
            )}
            {hasChildren ? (
              <ChevronDown size={13} style={{
                flexShrink: 0, opacity: 0.5,
                transform:  isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }} />
            ) : (
              !item.soon && isActive && (
                <span className="rounded-full"
                  style={{ width: 5, height: 5, background: 'var(--color-primary)', flexShrink: 0 }} />
              )
            )}
          </>
        )}
      </button>

      {hasChildren && isOpen && expanded && (
        <div className="mb-1" style={{ paddingLeft: 10 }}>
          {item.children.map(child => (
            <SubNavItem key={child.id} item={child}
              active={activePage === child.id} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ expanded, activePage, setActivePage, koiosOpen, onToggleKoios }) {
  const { t } = useTranslation('common')
  const [openItems, setOpenItems] = useState([])
  const auth = useAuth()
  const koiosEntitled = canUseKoios(auth)

  const toggleOpen = (id) =>
    setOpenItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])

  // Show only the pages/modules this user may access, driven by accessible_pages.
  // For items with children (e.g. Details), also filter each child by canAccessPage.
  // Labels are resolved from i18n (common.nav.*) by id at the same time.
  const visibleNavItems = NAV_ITEMS
    .filter(item => canAccessPage(item.id, auth))
    .map(item => {
      if (!item.children) return { ...item, label: navLabel(t, item.id) }
      return { ...item, label: navLabel(t, item.id),
        children: item.children.filter(child => canAccessPage(child.id, auth)).map(c => ({ ...c, label: navLabel(t, c.id) })) }
    })
  const visibleModuleItems = MODULE_NAV_ITEMS
    .filter(item => canAccessPage(item.id, auth))
    .map(item => {
      if (!item.children) return { ...item, label: navLabel(t, item.id) }
      return { ...item, label: navLabel(t, item.id),
        children: item.children.filter(child => canAccessPage(child.id, auth)).map(c => ({ ...c, label: navLabel(t, c.id) })) }
    })
  const showSettings       = canAccessPage('settings', auth)

  return (
    <div className="flex flex-col flex-shrink-0 overflow-hidden transition-all duration-200"
      style={{ width: expanded ? 220 : 56, background: 'var(--sidebar-bg)',
               borderRight: '1px solid var(--sidebar-border)' }}>

      {/* Brand */}
      <div className="flex items-center justify-center flex-shrink-0"
        style={{
          padding:      '14px 0 13px',
          borderBottom: '1px solid var(--sidebar-border)',
          minHeight: 56,
        }}>
        <div className="flex items-center" style={{ gap: 9, paddingLeft: expanded ? 14 : 0, paddingRight: expanded ? 10 : 0, width: '100%', justifyContent: expanded ? 'flex-start' : 'center' }}>
          {expanded
            ? <img src="/KoiosMatch.png" alt="KoiosMatch" style={{ height: 28, width: 'auto' }} />
            : <img src="/favicon.png" alt="KoiosMatch" style={{ width: 28, height: 28, objectFit: 'contain' }} />
          }
        </div>
      </div>

      <TenantSwitcher expanded={expanded} />

      {/* Nav — only the items this user may access */}
      <div className="flex-1 overflow-auto" style={{ padding: '10px 6px' }}>
        {visibleNavItems.map(item => (
          <NavItem key={item.id} item={item} activePage={activePage}
            expanded={expanded} openItems={openItems}
            toggleOpen={toggleOpen} onNavigate={setActivePage} />
        ))}

        {/* Modules — separate group, only for users who may access them (super admins) */}
        {visibleModuleItems.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {expanded && (
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--sidebar-muted)', letterSpacing: '0.08em',
                            textTransform: 'uppercase', padding: '0 10px 4px' }}>
                {t('nav.modulesGroup')}
              </div>
            )}
            {visibleModuleItems.map(item => (
              <NavItem key={item.id} item={item} activePage={activePage}
                expanded={expanded} openItems={openItems}
                toggleOpen={toggleOpen} onNavigate={setActivePage} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom — Koios toggle + Settings */}
      <div style={{ padding: '6px 6px 10px', borderTop: '1px solid var(--sidebar-border)' }}>
        {/* Koios AI knop — alleen als de tenant de module + permissie heeft */}
        {koiosEntitled && (
        <button
          onClick={onToggleKoios}
          title="Koios AI"
          className="flex items-center w-full rounded-lg mb-1 border-none cursor-pointer font-sans transition-all duration-150"
          style={{
            gap:            expanded ? 9 : 0,
            padding:        expanded ? '7px 10px' : '7px',
            justifyContent: expanded ? 'flex-start' : 'center',
            // Koios AI brand gradient: primary + violet token (mirrors KoiosHeader/KoiosMentionMenu).
            background: koiosOpen
              ? 'linear-gradient(135deg, var(--color-primary), var(--color-violet))'
              // color-mix — a var() cannot take a hex-alpha suffix ('var(--x)20' is
              // invalid CSS, the declaration was silently dropped; audit-consolidatie 23-07).
              : 'linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 12%, transparent), color-mix(in srgb, var(--color-violet) 12%, transparent))',
            color: '#fff',
          }}
        >
          <div className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 18, height: 18, background: koiosOpen ? 'rgba(255,255,255,0.25)' : 'var(--color-primary)' }}>
            <BrainCircuit size={11} color="white" />
          </div>
          {expanded && (
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1, textAlign: 'left',
              color: koiosOpen ? '#fff' : 'var(--color-primary)' }}>
              Koios
            </span>
          )}
          {expanded && !koiosOpen && (
            <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px',
              background: 'var(--color-primary)', color: '#fff', borderRadius: 99, letterSpacing: '0.04em' }}>
              AI
            </span>
          )}
        </button>
        )}

        {showSettings && (
          <NavItem item={{ id: 'settings', label: t('nav.settings'), icon: Settings }}
            activePage={activePage} expanded={expanded}
            openItems={openItems} toggleOpen={toggleOpen} onNavigate={setActivePage} />
        )}
      </div>
    </div>
  )
}