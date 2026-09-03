/**
 * DashboardLayout · popstate kmIntentData seam (MATCH-APPROVAL-2). A notification
 * click dispatches a SYNTHETIC popstate carrying `{ kmSynthetic, kmPage,
 * kmIntentData }` (see notificationTarget.ts). DashboardLayout's `onPop` handler
 * must forward `kmIntentData` to the target page's `intent` prop AND only switch
 * the active page when `kmPage` names a route that actually exists in
 * PAGE_TITLES — a stray/renamed page id must never become the active page.
 * Heavy chrome (Sidebar, KoiosPanel, NotificationBell, the tenant-theme fetch)
 * is stubbed so this test stays about the popstate wiring, not the shell's UI.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import DashboardLayout from './DashboardLayout'

// Heavy/irrelevant chrome — stubbed so this suite only exercises the popstate wiring.
vi.mock('./Sidebar', () => ({ default: () => null }))
vi.mock('./KoiosPanel', () => ({ default: () => null }))
vi.mock('../reports/ReportFilterSidebar', () => ({ default: () => null }))
vi.mock('@/components/layout/NotificationBell', () => ({ default: () => null }))
vi.mock('@/hooks/useTenantTheme', () => ({ useTenantTheme: () => {} }))

// Minimal auth/right-panel/access stand-ins — no login flow or API seam needed here.
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'Test User' }, activeTenant: { id: 't1', name: 'Acme' },
    logout: () => {}, hasModule: () => false, hasPermission: () => true,
    isSuperAdmin: () => false, dashboardType: () => 'readonly',
  }),
}))
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ filterGroups: [], pageFilterActive: false }),
}))
vi.mock('@/lib/access', () => ({ canAccessPage: () => true, PACKAGE_DEFAULT_PAGE: {} }))
vi.mock('@/pages/dashboard/shared', () => ({
  DashboardSwitcher: () => null, canSwitchViews: () => false, switcherTypes: () => [],
}))

// The page registry: renderPage becomes a spy that renders a stub carrying the
// exact `navIntent` it received, so the popstate -> intent wire is provable
// without mounting the real (heavy, lazily-loaded) page components.
vi.mock('./appPages', () => ({
  PAGE_TITLES: { dashboard: 'Dashboard', matches: 'Matches' },
  renderPage: (activePage: string, opts: { navIntent?: unknown }) => (
    <div data-testid={`page-${activePage}`} data-intent={JSON.stringify(opts.navIntent ?? null)} />
  ),
}))

describe('DashboardLayout · popstate kmIntentData (MATCH-APPROVAL-2)', () => {
  it('forwards kmIntentData to the target page as its nav intent and switches the active page', () => {
    render(<DashboardLayout />)
    // No hash on boot -> default page (dashboard) is mounted.
    expect(screen.getByTestId('page-dashboard')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', {
        state: { kmSynthetic: true, kmPage: 'matches', kmIntentData: { pendingApprovalOnly: true } },
      }))
    })

    const page = screen.getByTestId('page-matches')
    expect(page).toHaveAttribute('data-intent', JSON.stringify({ pendingApprovalOnly: true }))
    // The shell really swapped the active page, not just re-rendered the old one.
    expect(screen.queryByTestId('page-dashboard')).toBeNull()
  })

  it('an UNKNOWN kmPage (not in PAGE_TITLES) never becomes the active page', () => {
    render(<DashboardLayout />)
    expect(screen.getByTestId('page-dashboard')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', {
        state: { kmSynthetic: true, kmPage: 'not-a-real-page', kmIntentData: { pendingApprovalOnly: true } },
      }))
    })

    // Still on dashboard — an unrecognised route id must never switch the page.
    expect(screen.getByTestId('page-dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('page-not-a-real-page')).toBeNull()
  })
})
