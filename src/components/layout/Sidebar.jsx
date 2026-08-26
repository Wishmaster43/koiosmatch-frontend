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
import { REPORT_IDS } from '@/pages/reports/shared'
import TenantSwitcher from './TenantSwitcher'
import {
  LayoutDashboard, Users, Building2,
  MessageCircle, Settings, ChevronDown, Brain, BarChart3, TrendingUp, BrainCircuit,
  FileText, Briefcase, Handshake, ListChecks, Target, PieChart, PhoneCall, CalendarDays,
} from 'lucide-react'

// Resolve a nav item's label from i18n by id (dots → underscores to stay flat,
// since i18next treats a dot as nesting and e.g. nav.shiftmanager is already a
// string). The registry's hardcoded Dutch label is kept only as the defaultValue
// fallback, so a future id without a key degrades to readable text, not a raw key.
const navLabel = (t, id, fallback) => t(`nav.${id.replace(/\./g, '_')}`, { defaultValue: fallback })

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
    // One child per report sub-page, in REPORT_IDS order (reports/reportIds.ts is
    // the single source for that order; labels resolve via navLabel → common.nav.*).
    children: REPORT_IDS.map(id => ({ id: `reports.${id}` })),
  },
]

// Module pages — shown in a separate "Modules" nav group. All are gated by
// accessible_pages (super admin enables them per tenant via the Modules settings tab).
const MODULE_NAV_ITEMS = [
  {
    id: 'shiftmanager', label: 'Shiftmanager', icon: BarChart3,
    children: [
      // Reports (analytics)
      { id: 'shiftmanager.dashboard',        label: 'Dashboard' },
      { id: 'shiftmanager.customers',        label: 'Klanten-SM' },
      { id: 'shiftmanager.locations',        label: 'Locaties-SM' },
      { id: 'shiftmanager.departments',      label: 'Afdelingen-SM' },
      { id: 'shiftmanager.candidates',       label: 'Kandidaten-SM' },
      { id: 'shiftmanager.candidate-shifts', label: 'Kandidaten-Shifts' },
      // Tables (operational data)
      { id: 'shiftmanager.customers-table',   label: 'Klanten' },
      { id: 'shiftmanager.locations-table',   label: 'Locaties' },
      { id: 'shiftmanager.departments-table', label: 'Afdelingen' },
      { id: 'shiftmanager.candidates-table',  label: 'Kandidaten' },
      { id: 'shiftmanager.contacts-table',    label: 'Contactpersonen' },
      { id: 'shiftmanager.orders-table',      label: 'Diensten' },
      // Communication / AI (standalone, module-gated)
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

// One child row under an expanded nav group (e.g. a "Details" sub-page); active
// state reads the theme-adjusted primary tokens so it stays readable per tenant brand.
function SubNavItem({ item, active, onNavigate }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={() => onNavigate(item.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center w-full rounded-lg mb-0.5 border-none cursor-pointer font-sans transition-all duration-150"
      // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- app-chrome control (components/layout = chrome, HUISSTIJL-1): nav-rail/topbar place-marker with its own active state, not an action button; Button variants deliberately don't cover the rail
      style={{
        gap: 8, padding: '6px 10px',
        background: active ? 'var(--color-primary-bg)' : hovered ? 'var(--sidebar-hover)' : 'transparent',
        // SIDEBAR-CONTRAST-1 (Danny 08-08, "AENF is nog steeds niet leesbaar"): the
        // active label is the accent used AS TEXT on a near-white sidebar, so it must
        // read the theme-adjusted token, never the raw brand. Measured: AENF's yellow
        // #ffde00 on the white sidebar scores 1.1:1 — invisible.
        color:      active ? 'var(--color-primary-text)' : hovered ? 'var(--sidebar-text)' : 'var(--sidebar-muted)',
      }}
    >
      <div className="flex-shrink-0 rounded-full"
        style={{ width: 4, height: 4, marginLeft: 2,
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- chrome accent surface (active nav marker/brand dot, see the adjacent ACCENT-INK/SIDEBAR-CONTRAST comments), not an action surface
          background: active ? 'var(--color-primary)' : 'currentColor' }} />
      <span style={{ fontSize: 12, fontWeight: active ? 500 : 400 }}>{item.label}</span>
    </button>
  )
}

// A top-level nav entry: a leaf link, or (with children) a group that expands
// its sub-items in place while the rail stays expanded.
function NavItem({ item, activePage, expanded, openItems, toggleOpen, onNavigate }) {
  const { t } = useTranslation('common')
  const [hovered, setHovered] = useState(false)

  const hasChildren = !!item.children?.length
  const mainPage    = activePage?.split('.')[0]
  const isActive    = !hasChildren && mainPage === item.id
  const isOpen      = openItems.includes(item.id)
  const Icon        = item.icon

  // A group item both toggles its expansion AND navigates to its own page (e.g.
  // Settings groups still act as a page); a leaf item just navigates.
  const handleClick = () => {
    if (hasChildren) { toggleOpen(item.id); onNavigate(item.id) }
    else onNavigate(item.id)
  }

  return (
    <div>
      <button
        onClick={handleClick}
        // Unconditional name (milestone-heraudit): collapsed, the label span is
        // gone and title alone is a tooltip, not a name (§6).
        aria-label={item.label}
        title={!expanded ? item.label : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="flex items-center w-full rounded-lg mb-0.5 border-none cursor-pointer font-sans transition-all duration-150"
        // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- app-chrome control (components/layout = chrome, HUISSTIJL-1): nav-rail/topbar place-marker with its own active state, not an action button; Button variants deliberately don't cover the rail
        style={{
          gap:            expanded ? 9 : 0,
          padding:        expanded ? '7px 10px' : '7px',
          justifyContent: expanded ? 'flex-start' : 'center',
          background: isActive ? 'var(--color-primary-bg)' : hovered ? 'var(--sidebar-hover)' : 'transparent',
          // SIDEBAR-CONTRAST-1 — same reason as SubNavItem above: accent AS text.
          color:      isActive ? 'var(--color-primary-text)' : hovered ? 'var(--sidebar-text)' : 'var(--sidebar-muted)',
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
                  // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- chrome accent surface (active nav marker/brand dot, see the adjacent ACCENT-INK/SIDEBAR-CONTRAST comments), not an action surface
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

// The app's left navigation rail: renders only the pages/modules this user's role
// can access, resolves nav labels through i18n, and hosts the Koios panel toggle.
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
      if (!item.children) return { ...item, label: navLabel(t, item.id, item.label) }
      return { ...item, label: navLabel(t, item.id, item.label),
        children: item.children.filter(child => canAccessPage(child.id, auth)).map(c => ({ ...c, label: navLabel(t, c.id, c.label) })) }
    })
  const visibleModuleItems = MODULE_NAV_ITEMS
    .filter(item => canAccessPage(item.id, auth))
    .map(item => {
      if (!item.children) return { ...item, label: navLabel(t, item.id, item.label) }
      return { ...item, label: navLabel(t, item.id, item.label),
        children: item.children.filter(child => canAccessPage(child.id, auth)).map(c => ({ ...c, label: navLabel(t, c.id, c.label) })) }
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
        {/* Koios AI button — only when the tenant has the module + permission */}
        {koiosEntitled && (
        <button
          onClick={onToggleKoios}
          // Brand name, identical in every locale — aria-label names the collapsed
          // icon-only state (milestone-heraudit, same class as NavItem above).
          aria-label="Koios AI"
          title="Koios AI"
          className="flex items-center w-full rounded-lg mb-1 border-none cursor-pointer font-sans transition-all duration-150"
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- app-chrome control (components/layout = chrome, HUISSTIJL-1): nav-rail/topbar place-marker with its own active state, not an action button; Button variants deliberately don't cover the rail
          style={{
            gap:            expanded ? 9 : 0,
            padding:        expanded ? '7px 10px' : '7px',
            justifyContent: expanded ? 'flex-start' : 'center',
            // KOIOS-NAV-TINT-1 (Danny 22-08): ONE visual language for both states —
            // the brand-gradient TINT pair (rest 12% / open 22%), per the active-nav
            // rule (tint = place-marker; a full fill reads as an action button)
            // color-mix — a var() cannot take a hex-alpha suffix ('var(--x)20' is
            // invalid CSS, the declaration was silently dropped; audit-consolidatie 23-07).
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- chrome/brand tint with deliberately its own percentages (Koios gradient rest/active pair), predates lib/tint and is not a status chip
            background: `linear-gradient(135deg, color-mix(in srgb, var(--color-primary) ${koiosOpen ? 22 : 12}%, transparent), color-mix(in srgb, var(--color-violet) ${koiosOpen ? 22 : 12}%, transparent))`,
            // ACCENT-INK-1: both states are light tint surfaces now, so the ink is
            // always the contrast-safe accent twin (AENF measured the raw accent 1.17:1).
            color: 'var(--color-primary-text)',
          }}
        >
          <div className="flex items-center justify-center rounded-full flex-shrink-0"
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- chrome accent surface (active nav marker/brand dot, see the adjacent ACCENT-INK/SIDEBAR-CONTRAST comments), not an action surface
            style={{ width: 18, height: 18, background: 'var(--color-primary)' }}>
            {/* The solid accent brand circle is the one constant across both states;
                on-accent keeps the icon readable on a light tenant brand. */}
            <BrainCircuit size={11} color="var(--color-on-accent)" />
          </div>
          {expanded && (
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- Koios brand label in the chrome with a fixed accent ink; the SectionTitle atom carries --text and doesn't fit here
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1, textAlign: 'left',
              color: 'var(--color-primary-text)' }}>
              Koios
            </span>
          )}
          {/* AI badge stays in BOTH states (KOIOS-NAV-TINT-1: one button, two strengths). */}
          {expanded && (
            <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px',
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- chrome accent surface (active nav marker/brand dot, see the adjacent ACCENT-INK/SIDEBAR-CONTRAST comments), not an action surface
              background: 'var(--color-primary)', color: 'var(--color-on-accent)', borderRadius: 99, letterSpacing: '0.04em' }}>
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