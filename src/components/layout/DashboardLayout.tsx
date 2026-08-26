/**
 * DashboardLayout — main shell after login.
 * [Left nav] [Topbar + Content] [Right filter panel (optional)]
 * Owns the active-page + panel state; the page itself comes from renderPage().
 */
import { useState, useEffect, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import type { ComponentType } from 'react'
import { SlidersHorizontal, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useRightPanel } from '@/context/RightPanelContext'
import { SelectionProvider } from '@/context/SelectionContext'
import { canAccessPage, PACKAGE_DEFAULT_PAGE } from '@/lib/access'
import Sidebar from './Sidebar'
import KoiosPanel from './KoiosPanel'
import ReportFilterSidebar from '../reports/ReportFilterSidebar'
import { renderPage, PAGE_TITLES } from './appPages'
import { NavigationProvider } from '@/context/NavigationContext'
import { DashboardSwitcher } from '@/pages/dashboard/shared'
import NotificationBell from '@/components/layout/NotificationBell'
import { useTenantTheme } from '@/hooks/useTenantTheme'
import { canSwitchViews, switcherTypes } from '@/pages/dashboard/shared'
import type { DashboardType } from '@/pages/dashboard/shared'
import type { ReportFilterGroup } from '@/types/reports'

// Sidebar is still JS (the other Claude owns it); accept its props loosely at this boundary.
const SidebarTyped = Sidebar as unknown as ComponentType<Record<string, unknown>>

// Fallback while a lazily-loaded page chunk is being fetched.
function PageLoader() {
  const { t } = useTranslation('common')
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm text-[var(--text-muted)] animate-pulse">{t('loading')}</p>
    </div>
  )
}

// Shown when a user opens a page they are not allowed to access.
function NoAccessPage() {
  const { t } = useTranslation('common')
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('noAccess')}</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{t('noAccessDesc')}</p>
      </div>
    </div>
  )
}

// The app shell: sidebar + active page + Koios/right panels, driving real browser
// history so back/forward navigates between pages instead of doing nothing.
export default function DashboardLayout() {
  const { t } = useTranslation('common')
  const [expanded,       setExpanded]       = useState(true)
  const auth0                               = useAuth()
  const pkg0                                = auth0?.activeTenant?.package ?? auth0?.user?.tenant?.package
  // Boot from the URL hash when it names a known page (deep-link/refresh survive);
  // Settings rewrites the hash to its own sections, so unknown hashes fall back.
  // Split on '/' (legacy sub-path) AND '?' (NAV-BACK-1's `?open=<id>` drawer param)
  // so a deep-linked drawer URL still resolves to its page, not the fallback.
  const [activePage,     setActivePage]     = useState(() => {
    const fromHash = window.location.hash.replace(/^#/, '').split(/[/?]/)[0]
    return (fromHash && PAGE_TITLES[fromHash]) ? fromHash : (PACKAGE_DEFAULT_PAGE[pkg0 ?? ''] ?? 'dashboard')
  })
  // Navigation intent: a filter the target page should apply when navigated to
  // (e.g. a dashboard KPI/chart click). Plain navigation (sidebar) clears it.
  const [navIntent,      setNavIntent]      = useState<unknown>(null)
  // Every page switch becomes a real history entry, so the browser's back/forward
  // work (Danny 2026-07-05: "terug in de browser doet niks").
  // A jump WITH an intent (KPI/doorklik) remembers where it came from → back-chip;
  // plain navigation (sidebar) clears it.
  const [jumpOrigin, setJumpOrigin] = useState<string | null>(null)
  // Navigates to a page: pushes a real history entry (so browser back/forward work)
  // and remembers where a KPI/doorklik jump came from for the back-chip.
  const goTo = (page: string, intent: unknown = null) => {
    setJumpOrigin(intent != null && page !== activePage ? activePage : null)
    setNavIntent(intent); setActivePage(page)
    window.history.pushState({ kmPage: page }, '', `#${page}`)
  }
  // Back/forward: restore the page from our history state (hash as reload fallback).
  // Same '/'+'?' split as above — a NAV-BACK-1 drawer entry's `kmPage` is already
  // the bare page (see useDrawerUrl), but the hash fallback still carries `?open=`.
  useEffect(() => {
    // User pressed browser back/forward: resolve the target page from the pushed
    // history state, falling back to the hash for a hard reload.
    const onPop = (e: PopStateEvent) => {
      const page = (e.state as { kmPage?: string } | null)?.kmPage
        ?? window.location.hash.replace(/^#/, '').split(/[/?]/)[0]
      if (page && PAGE_TITLES[page]) { setNavIntent(null); setActivePage(page) }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const [rightPanelOpen, setRightPanelOpen] = useState(false)
  const [koiosOpen,      setKoiosOpen]      = useState(false)
  const auth                                = auth0
  const { logout, user, activeTenant }      = auth ?? {}
  // Dashboard view (B-27) — super-admin + management may switch/preview any role's
  // dashboard from the topbar; others are pinned to their own. Full = management.
  const dashMyType = (auth?.dashboardType?.() ?? 'readonly') as DashboardType
  const dashCanSwitch = (auth?.isSuperAdmin?.() ?? false) || canSwitchViews(dashMyType)
  const [dashView, setDashView] = useState<DashboardType>(dashCanSwitch ? 'management' : dashMyType)
  // DASHBOARD-KIEZER-1 — the switcher's choosable list drops admin/sales/readonly and
  // gates 'planning' on the tenant module (same hasModule('plan') gate block.shifts uses).
  const hasPlanning = (auth?.hasModule ?? (() => false))('plan')
  const dashAllowed: DashboardType[] = dashCanSwitch ? switcherTypes(hasPlanning) : [dashMyType]
  const { filterGroups, pageFilterActive }  = useRightPanel()

  // Active tenant drives topbar branding. Super admins see the tenant they switched to;
  // regular users fall back to their own tenant from /auth/me.
  const tenant: { name?: string; logo_url?: string | null; primary_color?: string } =
    activeTenant ?? user?.tenant ?? { name: 'KoiosMatch', logo_url: null }
  useTenantTheme(tenant)

  // Only show the filter button when the current page has registered filter groups.
  const hasFilters    = filterGroups.length > 0
  // A group flagged noCount (a sort order that always has a value) never counts as active.
  const activeFilters = filterGroups.reduce((sum, g) => sum + ((g as { noCount?: boolean }).noCount ? 0 : ((g.selected as unknown[] | undefined)?.length ?? 0)), 0)

  return (
    // KOIOS-SELECTIE-CONTEXT-1: one shared selection slot for BOTH the routed
    // page (below, publishes) and KoiosPanel (sibling, reads) — see SelectionContext.
    <SelectionProvider>
    <div className="flex h-screen overflow-hidden">

      {/* ── Left navigation ── */}
      <SidebarTyped
        expanded={expanded}
        setExpanded={setExpanded}
        activePage={activePage}
        setActivePage={goTo}
        onTheme={() => {}}
        koiosOpen={koiosOpen}
        onToggleKoios={() => setKoiosOpen(o => !o)}
      />

      {/* ── Koios AI panel ── */}
      {/* onNavigate wires the landing-state radar's deep-links to the same page-switch
          the sidebar uses (KoiosPanel renders outside NavigationProvider's scope). */}
      <KoiosPanel open={koiosOpen} onClose={() => setKoiosOpen(false)} onNavigate={goTo} />

      {/* ── Right column: topbar + content + filter panel ── */}
      <div className="km-main-bg flex flex-col flex-1 overflow-hidden" style={{ background: 'var(--bg)' }}>

        {/* Topbar */}
        <div
          className="km-topbar flex items-center flex-shrink-0 gap-3 px-5"
          style={{ height: 52, background: 'var(--topbar-bg)', borderBottom: '1px solid var(--border)' }}
        >
          {/* Sidebar toggle */}
          <button
            onClick={() => setExpanded(e => !e)}
            aria-label={expanded ? t('sidebarCollapse') : t('sidebarExpand')}
            title={expanded ? t('sidebarCollapse') : t('sidebarExpand')}
            className="flex items-center justify-center flex-shrink-0 rounded-lg transition-colors"
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- app-chrome control (components/layout = chrome, HUISSTIJL-1): nav-rail/topbar place-marker with its own active state, not an action button; Button's variants deliberately don't cover the rail
            style={{
              width: 30, height: 30, border: 'none', cursor: 'pointer',
              background: 'transparent', color: 'var(--text-muted)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            {expanded ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          </button>

          {/* Tenant name — the start of the breadcrumb ("Yesway › Dashboard"). The logo
              itself sits on the right of the bar (LOGO-PLACE-1, Danny 14/7); the KM
              brand mark stays in the sidebar. */}
          <div className="flex items-center flex-shrink-0 gap-2">
            <div
              className="flex items-center justify-center flex-shrink-0 rounded-md"
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- chrome accent surface (active nav marker/brand circle, see the adjacent ACCENT-INK/SIDEBAR-CONTRAST comments), not an action surface
              style={{ width: 22, height: 22, background: 'var(--color-primary)', fontSize: 11, color: 'var(--color-on-accent)', fontWeight: 700 }}
            >
              {(tenant?.name ?? 'K').charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold text-[var(--text)]" style={{ fontSize: 13 }}>
              {tenant?.name ?? 'KoiosMatch'}
            </span>
          </div>

          {/* Breadcrumb separator + page title — PAGE_TITLES keys index the
              'pageTitles' namespace; keySeparator is off since some keys carry a
              literal dot ('reports.candidates'). The map value is the English fallback
              if a translation is ever missing. */}
          {/* Purely a visual divider between two labels, so it is marked decorative
              rather than darkened: it carries no meaning, a screen reader should skip
              it, and WCAG 1.4.3 exempts decorative text from the contrast floor. Left
              pale on purpose — it must not compete with the labels it separates. */}
          <span aria-hidden="true" style={{ color: 'var(--border)', fontSize: 16 }}>›</span>
          <span className="font-medium truncate" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {t(activePage, { ns: 'pageTitles', keySeparator: false, defaultValue: PAGE_TITLES[activePage] || activePage })}
          </span>
          {/* Back-chip after a cross-entity jump — one click returns to where you came from. */}
          {jumpOrigin && jumpOrigin !== activePage && (
            <button onClick={() => goTo(jumpOrigin)}
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- app-chrome control (components/layout = chrome, HUISSTIJL-1): nav-rail/topbar place-marker with its own active state, not an action button; Button's variants deliberately don't cover the rail
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', fontSize: 11, fontWeight: 600,
                borderRadius: 999, cursor: 'pointer', color: 'var(--color-primary-text)', flexShrink: 0,
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- chrome/brand tint with a deliberately own percentage (Koios gradient soft state / sidebar hover), predates lib/tint and is not a status chip
                background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- chrome/brand tint with a deliberately own percentage (Koios gradient soft state / sidebar hover), predates lib/tint and is not a status chip
                border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)' }}>
              ← {t('back')} · {t(jumpOrigin, { ns: 'pageTitles', keySeparator: false, defaultValue: PAGE_TITLES[jumpOrigin] || jumpOrigin })}
            </button>
          )}

          {/* Right actions */}
          <div className="flex items-center flex-shrink-0 gap-2 ml-auto">
            {/* Tenant logo — between the breadcrumb and the right-side actions
                (LOGO-PLACE-1, Danny 14/7). logo_url is a fresh signed URL per
                response (12 h workday TTL since LOGO-TTL-1b): render it straight from the tenant payload,
                never persist or cache it. Decorative (alt="") — the tenant name
                already reads as text in the breadcrumb. */}
            {tenant?.logo_url && (
              <img src={tenant.logo_url} alt="" aria-hidden
                style={{ height: 26, maxWidth: 120, objectFit: 'contain', borderRadius: 4, marginRight: 6 }} />
            )}
            {/* Dashboard view switcher — only on the dashboard; hidden for single-view users. */}
            {activePage === 'dashboard' && (
              <DashboardSwitcher value={dashView} options={dashAllowed} onChange={setDashView} />
            )}
            {/* Notifications bell — backend-driven, graceful until the feed exists */}
            <NotificationBell />
            {/* Avatar button — navigates to profile page */}
            {(() => {
              const initials = (
                [user?.firstname, user?.lastname].filter((n): n is string => Boolean(n)).map(n => n[0]).join('').toUpperCase()
                || (user?.name ?? '').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
                || (user?.email ?? '').slice(0, 2).toUpperCase()
                || '?'
              )
              return (
                <button
                  onClick={() => goTo('profile')}
                  title={[user?.firstname, user?.lastname].filter(Boolean).join(' ') || user?.name || t('profile', { ns: 'pageTitles' })}
                  // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- app-chrome control (components/layout = chrome, HUISSTIJL-1): nav-rail/topbar place-marker with its own active state, not an action button; Button's variants deliberately don't cover the rail
                  style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- chrome accent surface (active nav marker/brand circle, see the adjacent ACCENT-INK/SIDEBAR-CONTRAST comments), not an action surface
                    background: activePage === 'profile' ? 'var(--color-primary)' : 'var(--color-primary-bg)',
                    // ACCENT-INK-1: resting, the initials sit on --color-primary-bg (a 12% tint
                    // of the brand), so they need the contrast-safe twin (AENF measured 1.14:1).
                    color: activePage === 'profile' ? 'var(--color-on-accent)' : 'var(--color-primary-text)',
                    border: `1.5px solid ${activePage === 'profile' ? 'var(--color-primary)' : 'transparent'}`,
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all var(--motion-fast)',
                  }}
                >
                  {initials}
                </button>
              )
            })()}

            {/* Filter button — only visible when the current page has registered filters */}
            {hasFilters && (
              <button
                onClick={() => setRightPanelOpen(o => !o)}
                // The count badge is text CONTENT, so without aria-label the button
                // announces as a bare number (milestone-heraudit) — the label carries
                // the count instead and the badge goes aria-hidden below.
                aria-label={activeFilters > 0 ? t('filters.toggleActive', { count: activeFilters }) : t('filters.toggle')}
                title={t('filters.toggle')}
                className="flex items-center justify-center transition-colors rounded-lg"
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- app-chrome control (components/layout = chrome, HUISSTIJL-1): nav-rail/topbar place-marker with its own active state, not an action button; Button's variants deliberately don't cover the rail
                style={{
                  position: 'relative',
                  width: 30, height: 30,
                  background: rightPanelOpen ? 'var(--color-primary-bg)' : 'var(--hover-bg)',
                  border:     `1px solid ${rightPanelOpen ? 'var(--color-primary)' : 'var(--border)'}`,
                  // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                  color:      rightPanelOpen ? 'var(--color-primary-text)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <SlidersHorizontal size={14} />
                {activeFilters > 0 ? (
                  <span aria-hidden="true" style={{
                    position: 'absolute', top: -5, right: -5,
                    // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- chrome accent surface (active nav marker/brand circle, see the adjacent ACCENT-INK/SIDEBAR-CONTRAST comments), not an action surface
                    background: 'var(--color-primary)', color: 'var(--color-on-accent)',
                    borderRadius: 999, fontSize: 10, fontWeight: 700,
                    minWidth: 16, height: 16, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px', lineHeight: 1,
                  }}>
                    {activeFilters}
                  </span>
                ) : pageFilterActive ? (
                  // Page-level filters (search/KPI picks/attention) active — show a
                  // warning dot so a narrowed list is visible even with the panel idle.
                  <span aria-label={t('filtersActive')} title={t('filtersActive')} style={{
                    position: 'absolute', top: -4, right: -4,
                    width: 10, height: 10, borderRadius: 999,
                    background: 'var(--color-warning)',
                    border: '2px solid var(--bg)',
                  }} />
                ) : null}
              </button>
            )}

            <button
              onClick={logout}
              className="text-xs rounded-md px-3 py-1.5"
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- app-chrome control (components/layout = chrome, HUISSTIJL-1): nav-rail/topbar place-marker with its own active state, not an action button; Button's variants deliberately don't cover the rail
              style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              {/* §5: reuse the existing auth key — one source per label (audit r4;
                  it lives under mfaGate but is the generic "Uitloggen" label). */}
              {t('auth:mfaGate.signOut')}
            </button>
          </div>
        </div>

        {/* Content row: page + optional right filter panel side by side */}
        <div className="flex flex-1 overflow-hidden">
          {/* key on tenant id: switching bureau remounts the page so its data reloads */}
          <div key={activeTenant?.id ?? 'none'} className="flex-1 overflow-auto">
            <Suspense fallback={<PageLoader />}>
              <NavigationProvider goTo={goTo}>
                {canAccessPage(activePage, auth) ? renderPage(activePage, { navIntent, goTo, dashView }) : <NoAccessPage />}
              </NavigationProvider>
            </Suspense>
          </div>

          {/* Right filter panel — same height as content, slides next to page */}
          {rightPanelOpen && hasFilters && (
            <div
              className="km-right-panel flex-shrink-0 overflow-y-auto"
              style={{ width: 360, borderLeft: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              <ReportFilterSidebar
                title={t('filters.title')}
                groups={filterGroups as ReportFilterGroup[]}
                onClose={() => setRightPanelOpen(false)}
                pageId={activePage}
              />
            </div>
          )}
        </div>
      </div>
    </div>
    </SelectionProvider>
  )
}
