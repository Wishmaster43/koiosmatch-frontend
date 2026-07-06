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
import { canAccessPage, PACKAGE_DEFAULT_PAGE } from '@/lib/access'
import Sidebar from './Sidebar'
import KoiosPanel from './KoiosPanel'
import ReportFilterSidebar from '../reports/ReportFilterSidebar'
import { renderPage, PAGE_TITLES } from './appPages'
import { NavigationProvider } from '@/context/NavigationContext'
import DashboardSwitcher from '@/pages/dashboard/DashboardSwitcher'
import NotificationBell from '@/components/layout/NotificationBell'
import { useTenantTheme } from '@/hooks/useTenantTheme'
import { DASHBOARD_TYPES, canSwitchViews } from '@/pages/dashboard/templates'
import type { DashboardType } from '@/pages/dashboard/templates'
import type { ReportFilterGroup } from '@/types/reports'

// Sidebar is still JS (the other Claude owns it); accept its props loosely at this boundary.
const SidebarTyped = Sidebar as unknown as ComponentType<Record<string, unknown>>

// Fallback while a lazily-loaded page chunk is being fetched.
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm text-[var(--text-muted)] animate-pulse">Laden…</p>
    </div>
  )
}

// Shown when a user opens a page they are not allowed to access.
function NoAccessPage() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Geen toegang</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Je hebt geen rechten voor deze pagina.</p>
      </div>
    </div>
  )
}

export default function DashboardLayout() {
  const { t } = useTranslation('common')
  const [expanded,       setExpanded]       = useState(true)
  const auth0                               = useAuth()
  const pkg0                                = auth0?.activeTenant?.package ?? auth0?.user?.tenant?.package
  // Boot from the URL hash when it names a known page (deep-link/refresh survive);
  // Settings rewrites the hash to its own sections, so unknown hashes fall back.
  const [activePage,     setActivePage]     = useState(() => {
    const fromHash = window.location.hash.replace(/^#/, '').split('/')[0]
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
  const goTo = (page: string, intent: unknown = null) => {
    setJumpOrigin(intent != null && page !== activePage ? activePage : null)
    setNavIntent(intent); setActivePage(page)
    window.history.pushState({ kmPage: page }, '', `#${page}`)
  }
  // Back/forward: restore the page from our history state (hash as reload fallback).
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const page = (e.state as { kmPage?: string } | null)?.kmPage
        ?? window.location.hash.replace(/^#/, '').split('/')[0]
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
  const dashAllowed: DashboardType[] = dashCanSwitch ? [...DASHBOARD_TYPES] : [dashMyType]
  const { filterGroups, pageFilterActive }  = useRightPanel()

  // Active tenant drives topbar branding. Super admins see the tenant they switched to;
  // regular users fall back to their own tenant from /auth/me.
  const tenant: { name?: string; logo_url?: string | null; primary_color?: string } =
    activeTenant ?? user?.tenant ?? { name: 'KoiosMatch', logo_url: null }
  useTenantTheme(tenant)

  // Only show the filter button when the current page has registered filter groups.
  const hasFilters    = filterGroups.length > 0
  const activeFilters = filterGroups.reduce((sum, g) => sum + ((g.selected as unknown[] | undefined)?.length ?? 0), 0)

  return (
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
      <KoiosPanel open={koiosOpen} onClose={() => setKoiosOpen(false)} />

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
            title={expanded ? 'Sidebar inklappen' : 'Sidebar uitklappen'}
            className="flex items-center justify-center flex-shrink-0 rounded-lg transition-colors"
            style={{
              width: 30, height: 30, border: 'none', cursor: 'pointer',
              background: 'transparent', color: 'var(--text-muted)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            {expanded ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          </button>

          {/* Tenant logo + naam (de bureau-switcher zelf zit in de Sidebar-kaart) */}
          <div className="flex items-center flex-shrink-0 gap-2">
            {tenant?.logo_url
              ? <img src={tenant.logo_url} alt="" style={{ height: 22, borderRadius: 4 }} />
              : (
                <div
                  className="flex items-center justify-center flex-shrink-0 rounded-md"
                  style={{ width: 22, height: 22, background: 'var(--color-primary)', fontSize: 11, color: 'white', fontWeight: 700 }}
                >
                  {(tenant?.name ?? 'K').charAt(0).toUpperCase()}
                </div>
              )
            }
            <span className="font-semibold text-[var(--text)]" style={{ fontSize: 13 }}>
              {tenant?.name ?? 'KoiosMatch'}
            </span>
          </div>

          {/* Breadcrumb separator + page title */}
          <span style={{ color: 'var(--border)', fontSize: 16 }}>›</span>
          <span className="font-medium truncate" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {PAGE_TITLES[activePage] || activePage}
          </span>
          {/* Back-chip after a cross-entity jump — one click returns to where you came from. */}
          {jumpOrigin && jumpOrigin !== activePage && (
            <button onClick={() => goTo(jumpOrigin)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', fontSize: 11, fontWeight: 600,
                borderRadius: 999, cursor: 'pointer', color: 'var(--color-primary)', flexShrink: 0,
                background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)' }}>
              ← {t('back')} · {PAGE_TITLES[jumpOrigin] || jumpOrigin}
            </button>
          )}

          {/* Right actions */}
          <div className="flex items-center flex-shrink-0 gap-2 ml-auto">
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
                  title={[user?.firstname, user?.lastname].filter(Boolean).join(' ') || user?.name || 'Profiel'}
                  style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: activePage === 'profile' ? 'var(--color-primary)' : 'var(--color-primary-bg)',
                    color: activePage === 'profile' ? 'white' : 'var(--color-primary)',
                    border: `1.5px solid ${activePage === 'profile' ? 'var(--color-primary)' : 'transparent'}`,
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
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
                title="Filters tonen/verbergen"
                className="flex items-center justify-center transition-colors rounded-lg"
                style={{
                  position: 'relative',
                  width: 30, height: 30,
                  background: rightPanelOpen ? 'var(--color-primary-bg)' : 'var(--hover-bg)',
                  border:     `1px solid ${rightPanelOpen ? 'var(--color-primary)' : 'var(--border)'}`,
                  color:      rightPanelOpen ? 'var(--color-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <SlidersHorizontal size={14} />
                {activeFilters > 0 ? (
                  <span style={{
                    position: 'absolute', top: -5, right: -5,
                    background: 'var(--color-primary)', color: '#fff',
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
              style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              Uitloggen
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
              style={{ width: 240, borderLeft: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              <ReportFilterSidebar
                title="Filters"
                groups={filterGroups as ReportFilterGroup[]}
                onClose={() => setRightPanelOpen(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
