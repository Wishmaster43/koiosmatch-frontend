/**
 * App.jsx — application root
 * Contains client-side routing, auth guard, and DashboardLayout.
 * DashboardLayout manages: left nav, topbar, right filter panel.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider }                     from '@tanstack/react-query'
import { queryClient }                             from './lib/queryClient'
import { AuthProvider, useAuth }                   from './context/AuthContext'
import { RightPanelProvider, useRightPanel }       from './context/RightPanelContext'
import { useState, useEffect, lazy, Suspense }     from 'react'
import { SlidersHorizontal, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import './index.css'

// ── Shell (always loaded) ────────────────────────────────────────────────────
import LoginPage              from './pages/auth/LoginPage'
import Sidebar                from './components/layout/Sidebar'
import KoiosPanel             from './components/layout/KoiosPanel'
import ReportFilterSidebar    from './components/reports/ReportFilterSidebar'
import ErrorBoundary          from '@/components/ui/ErrorBoundary'

// ── Page imports (lazy) ──────────────────────────────────────────────────────
// Each page is its own chunk, so heavy deps (workflow canvas, PDF renderer,
// recharts, tiptap) only download when that page is actually opened.
const Dashboard              = lazy(() => import('./pages/dashboard/Dashboard'))
const WorkflowsPage          = lazy(() => import('./pages/ai/WorkflowsPage'))
const CandidatesReport       = lazy(() => import('./pages/shiftmanager/CandidatesReport'))
const CandidatesPage         = lazy(() => import('./pages/candidates/CandidatesPage'))
const CandidatesDetailPage   = lazy(() => import('./pages/shiftmanager/CandidatesDetailPage'))
const CustomerReport         = lazy(() => import('./pages/shiftmanager/CustomersReport'))
const CustomersDetailPage    = lazy(() => import('./pages/shiftmanager/CustomersDetailPage'))
const OrdersReport           = lazy(() => import('./pages/shiftmanager/OrdersReport'))
const SettingsPage           = lazy(() => import('./pages/settings/SettingsPage'))
const LocationsDetailPage    = lazy(() => import('./pages/shiftmanager/LocationsDetailPage'))
const LocationsReport        = lazy(() => import('./pages/shiftmanager/LocationsReport'))
const DepartmentsDetailPage  = lazy(() => import('./pages/shiftmanager/DepartmentsDetailPage'))
const DepartmentsReport      = lazy(() => import('./pages/shiftmanager/DepartmentsReport'))
const ContactsDetailPage     = lazy(() => import('./pages/shiftmanager/ContactsDetailPage'))
const ContactPersonsPage     = lazy(() => import('./pages/shiftmanager/ContactPersonsPage'))
const CustomersPage          = lazy(() => import('./pages/customers/CustomersPage'))
const SmCustomersPage        = lazy(() => import('./pages/shiftmanager/CustomersPage'))
const ContactsPage           = lazy(() => import('./pages/shiftmanager/ContactsPage'))
const LocationsPage          = lazy(() => import('./pages/shiftmanager/LocationsPage'))
const DepartmentsPage        = lazy(() => import('./pages/shiftmanager/DepartmentsPage'))
const ProfilePage            = lazy(() => import('./pages/auth/ProfilePage'))
const UsersPage              = lazy(() => import('./pages/users/UsersPage'))
const WhatsAppPage           = lazy(() => import('./pages/whatsapp/WhatsAppPage'))
const RunsDetailPage         = lazy(() => import('./pages/ai/RunsDetailPage'))
const MessagesDetailPage     = lazy(() => import('./pages/ai/MessagesDetailPage'))
const ShiftmanagerDetailsPage = lazy(() => import('./pages/shiftmanager/ShiftmanagerDetailsPage'))
const ShiftmanagerDashboard  = lazy(() => import('./pages/shiftmanager/ShiftmanagerDashboard'))
const PlanningPage           = lazy(() => import('./pages/planning/PlanningPage'))
const ApplicationsPage       = lazy(() => import('./pages/applications/ApplicationsPage'))
const VacanciesPage          = lazy(() => import('./pages/vacancies/VacanciesPage'))
const MatchesPage            = lazy(() => import('./pages/matches/MatchesPage'))
const OpportunitiesPage      = lazy(() => import('./pages/opportunities/OpportunitiesPage'))
const TasksPage              = lazy(() => import('./pages/tasks/TasksPage'))
import { ThemeProvider }      from './context/ThemeContext'
import { AppsProvider } from './context/AppsContext'
import { LookupsProvider } from './context/LookupsContext'
import { canAccessPage, PACKAGE_DEFAULT_PAGE } from './lib/access'

// ── Page title map (route key → breadcrumb label) ────────────────────────────
const PAGE_TITLES = {
  // Core
  dashboard:                    'Dashboard',
  settings:                     'Settings',
  users:                        'Users',
  profile:                      'Profile',

  // ATS & CRM
  candidates:                   'Candidates',
  applications:                 'Applications',
  vacancies:                    'Vacancies',
  matches:                      'Matches',
  opportunities:                'Opportunities',
  tasks:                        'Tasks',
  customers:                    'Customers',
  'customers.locations':        'Customers — Locations',
  'customers.departments':      'Customers — Departments',
  'customers.contacts':         'Customers — Contacts',
  planning:                     'Planning',

  // Shiftmanager module
  shiftmanager:                 'Shiftmanager',
  'shiftmanager.dashboard':     'Shiftmanager — Dashboard',
  'shiftmanager.candidates':    'Shiftmanager — Candidates',
  'shiftmanager.customers':     'Shiftmanager — Customers',
  'shiftmanager.locations':     'Shiftmanager — Locations',
  'shiftmanager.departments':   'Shiftmanager — Departments',
  'shiftmanager.contacts':      'Shiftmanager — Contacts',
  'shiftmanager.details':       'Shiftmanager — Details',
  'shiftmanager.customers-table':   'Shiftmanager — Klanten',
  'shiftmanager.locations-table':   'Shiftmanager — Locaties',
  'shiftmanager.departments-table': 'Shiftmanager — Afdelingen',
  'shiftmanager.contacts-table':    'Shiftmanager — Contactpersonen',

  // Shiftmanager detail drill-downs (navigated to from SM reports)
  'details.candidates':         'SM Details — Candidates',
  'details.customers':          'SM Details — Customers',
  'details.locations':          'SM Details — Locations',
  'details.departments':        'SM Details — Departments',
  'details.contacts':           'SM Details — Contacts',
  'details.orders':             'SM Details — Shifts',

  // HelloFlex module
  helloflex:                    'HelloFlex',
  'helloflex.dashboard':        'HelloFlex — Dashboard',

  // AI & Workflow module
  aiagents:                     'AI Agents',
  workflows:                    'Workflows',
  whatsapp:                     'WhatsApp',
  'details.runs':               'AI Details — Runs',
  'details.messages':           'AI Details — Messages',
}

// Temporary placeholder for pages that are not built yet.
function PlaceholderPage({ title }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="font-mono text-sm text-gray-400">{title} — komt eraan</p>
    </div>
  )
}

// Fallback while a lazily-loaded page chunk is being fetched.
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm text-gray-400 animate-pulse">Laden…</p>
    </div>
  )
}

// Shown when a user opens a page they are not allowed to access.
function NoAccessPage() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Geen toegang</p>
        <p className="mt-1 text-xs text-gray-400">Je hebt geen rechten voor deze pagina.</p>
      </div>
    </div>
  )
}

/**
 * useTenantTheme — applies CSS variables based on tenant branding.
 * Backend returns { primary_color, logo_url } via /api/auth/me.
 */
function useTenantTheme(tenant) {
  useEffect(() => {
    if (!tenant) return
    const root = document.documentElement
    if (tenant.primary_color) {
      root.style.setProperty('--color-primary',    tenant.primary_color)
      root.style.setProperty('--color-primary-bg', tenant.primary_color + '18')
    }
  }, [tenant])
}

/**
 * DashboardLayout — main shell after login.
 * [Left nav] [Topbar + Content] [Right filter panel (optional)]
 */
function DashboardLayout() {
  const [expanded,       setExpanded]       = useState(true)
  const auth0                               = useAuth()
  const pkg0                                = auth0?.activeTenant?.package ?? auth0?.user?.tenant?.package
  const [activePage,     setActivePage]     = useState(PACKAGE_DEFAULT_PAGE[pkg0] ?? 'dashboard')
  // Navigation intent: a filter the target page should apply when navigated to
  // (e.g. a dashboard KPI/chart click). Plain navigation (sidebar) clears it.
  const [navIntent,      setNavIntent]      = useState(null)
  const goTo = (page, intent = null) => { setNavIntent(intent); setActivePage(page) }
  const [rightPanelOpen, setRightPanelOpen] = useState(false)
  const [koiosOpen,      setKoiosOpen]      = useState(false)
  const auth                                = auth0
  const { logout, user, activeTenant }      = auth
  const { filterGroups }                    = useRightPanel()

  // Active tenant drives topbar branding. Super admins see the tenant they switched to;
  // regular users fall back to their own tenant from /auth/me.
  const tenant = activeTenant ?? user?.tenant ?? { name: 'KoiosMatch', logo_url: null }
  useTenantTheme(tenant)

  // Only show the filter button when the current page has registered filter groups.
  const hasFilters    = filterGroups.length > 0
  const activeFilters = filterGroups.reduce((sum, g) => sum + (g.selected?.length ?? 0), 0)

  // Renders the page component for the active key.
  // Defense-in-depth: block admin-only pages for users who lack access, even if
  // they reach it via a direct/stale key (the nav already hides these items).
  const renderPage = () => {
    if (!canAccessPage(activePage, auth)) return <NoAccessPage />
    switch (activePage) {

      // ── Core ──────────────────────────────────────────────────────────────
      case 'dashboard':   return <Dashboard onNavigate={goTo} />
      case 'profile':     return <ProfilePage />
      case 'users':       return <UsersPage />
      case 'settings':    return <SettingsPage />

      // ── ATS & CRM ─────────────────────────────────────────────────────────
      case 'candidates':             return <CandidatesPage intent={navIntent} />
      case 'applications':           return <ApplicationsPage intent={navIntent} />
      case 'vacancies':              return <VacanciesPage />
      case 'matches':                return <MatchesPage intent={navIntent} />
      case 'opportunities':          return <OpportunitiesPage intent={navIntent} />
      case 'tasks':                  return <TasksPage intent={navIntent} />
      case 'customers':              return <CustomersPage />
      case 'planning':               return <PlanningPage />

      // ── Shiftmanager module ───────────────────────────────────────────────
      case 'shiftmanager':
      case 'shiftmanager.dashboard':   return <ShiftmanagerDashboard onNavigate={goTo} />
      // Reports
      case 'shiftmanager.candidates':  return <CandidatesReport initialTab="candidates" />
      case 'shiftmanager.customers':   return <CustomerReport />
      case 'shiftmanager.locations':   return <LocationsReport />
      case 'shiftmanager.departments': return <DepartmentsReport />
      case 'shiftmanager.contacts':    return <ContactPersonsPage />
      case 'shiftmanager.details':     return <ShiftmanagerDetailsPage />
      // Table pages (operational data tables)
      case 'shiftmanager.customers-table':   return <SmCustomersPage />
      case 'shiftmanager.locations-table':   return <LocationsPage />
      case 'shiftmanager.departments-table': return <DepartmentsPage />
      case 'shiftmanager.contacts-table':    return <ContactsPage />

      // Shiftmanager drill-down detail routes (navigated to from SM reports)
      case 'details.candidates':  return <CandidatesDetailPage />
      case 'details.customers':   return <CustomersDetailPage />
      case 'details.locations':   return <LocationsDetailPage />
      case 'details.departments': return <DepartmentsDetailPage />
      case 'details.contacts':    return <ContactsDetailPage />
      case 'details.orders':      return <OrdersReport />

      // ── HelloFlex module ──────────────────────────────────────────────────
      case 'helloflex':
      case 'helloflex.dashboard': return <PlaceholderPage title="HelloFlex Dashboard" />

      // ── AI & Workflow module ──────────────────────────────────────────────
      case 'aiagents':
      case 'workflows':           return <WorkflowsPage />
      case 'whatsapp':            return <WhatsAppPage />

      // AI & Workflow drill-down detail routes
      case 'details.runs':        return <RunsDetailPage />
      case 'details.messages':    return <MessagesDetailPage />

      default: return <PlaceholderPage title={PAGE_TITLES[activePage] || activePage} />
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── Left navigation ── */}
      <Sidebar
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
            <span className="font-semibold text-gray-900" style={{ fontSize: 13 }}>
              {tenant?.name ?? 'KoiosMatch'}
            </span>
          </div>

          {/* Breadcrumb separator + page title */}
          <span style={{ color: 'var(--border)', fontSize: 16 }}>›</span>
          <span className="font-medium truncate" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {PAGE_TITLES[activePage] || activePage}
          </span>

          {/* Right actions */}
          <div className="flex items-center flex-shrink-0 gap-2 ml-auto">
            {/* Avatar button — navigates to profile page */}
            {(() => {
              const initials = (
                [user?.firstname, user?.lastname].filter(Boolean).map(n => n[0]).join('').toUpperCase()
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
                  background: rightPanelOpen ? 'var(--color-primary-bg)' : '#F9FAFB',
                  border:     `1px solid ${rightPanelOpen ? 'var(--color-primary)' : '#E5E7EB'}`,
                  color:      rightPanelOpen ? 'var(--color-primary)' : '#6B7280',
                  cursor: 'pointer',
                }}
              >
                <SlidersHorizontal size={14} />
                {activeFilters > 0 && (
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
                )}
              </button>
            )}

            <button
              onClick={logout}
              className="text-xs rounded-md px-3 py-1.5"
              style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280' }}
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
              {renderPage()}
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
                groups={filterGroups}
                onClose={() => setRightPanelOpen(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Guards authenticated routes — redirects to /login when not logged in.
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: '#F5F5F7' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center rounded-xl animate-pulse"
            style={{ width: 40, height: 40, background: 'var(--color-primary)' }}>
            <span style={{ color: 'white', fontSize: 18 }}>⚡</span>
          </div>
          <p className="text-sm text-gray-400">Laden...</p>
        </div>
      </div>
    )
  }
  return user ? children : <Navigate to="/login" replace />
}

// Blocks authenticated users from the login page.
function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/" replace /> : children
}

export default function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <AuthProvider>
        <AppsProvider>
        <LookupsProvider>
        {/* RightPanelProvider inside AuthProvider so components can use both auth and filter panel context */}
        <RightPanelProvider>
          {/* Global boundary: a crash in any page shows a recoverable fallback,
              not a blank screen (§3). Heavy widgets get their own local boundaries. */}
          <ErrorBoundary>
            <Routes>
              <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
              <Route path="/*"     element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>} />
            </Routes>
          </ErrorBoundary>
        </RightPanelProvider>
        </LookupsProvider>
        </AppsProvider>
      </AuthProvider>
      </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}