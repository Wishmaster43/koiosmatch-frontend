/**
 * App.jsx — root van de applicatie
 * Bevat routing, auth guard, en de DashboardLayout.
 * DashboardLayout beheert: linker nav, topbar, rechter filterpanel.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth }                   from './context/AuthContext'
import { RightPanelProvider, useRightPanel }       from './context/RightPanelContext'
import { useState, useEffect }                     from 'react'
import { SlidersHorizontal }                       from 'lucide-react'
import './index.css'

// Pagina-imports
import LoginPage              from './pages/LoginPage'
import Dashboard              from './pages/Dashboard'
import WorkflowsPage          from './pages/Workflows'
import Sidebar                from './components/layout/Sidebar'
import ReportFilterSidebar    from './components/reports/ReportFilterSidebar'
import CandidatesReport        from './pages/candidates/CandidatesReport'
import CandidatesDetailPage   from './pages/candidates/CandidatesDetailPage'
import CustomerReport        from './pages/customers/CustomersReport'

import CustomersDetailPage    from './pages/customers/CustomersDetailPage'
import OrdersReport           from './pages/OrdersReport'
import SettingsPage           from './pages/SettingsPage'
import LocationsDetailPage    from './pages/locations/LocationsDetailPage'
import LocationsReport        from './pages/locations/LocationsReport'
import DepartmentsDetailPage  from './pages/departments/DepartmentsDetailPage'
import DepartmentsReport      from './pages/departments/DepartmentsReport'
import ContactsDetailPage     from './pages/contacts/ContactsDetailPage'
import ProfilePage            from './pages/ProfilePage'
import UsersPage              from './pages/UsersPage'
import RunsDetailPage         from './pages/details/RunsDetailPage'
import MessagesDetailPage     from './pages/details/MessagesDetailPage'
import { ThemeProvider }      from './context/ThemeContext'

// Mapping van route-sleutel naar leesbare paginatitel
const PAGE_TITLES = {
  dashboard:              'Dashboard',
  workflows:              'Workflows',
  candidates:             'Kandidaten',
  customers:              'Klanten',
  locations:              'Locaties',
  departments:            'Afdelingen',
  whatsapp:               'WhatsApp',
  'details.candidates':   'Details — Kandidaten',
  'details.customers':    'Details — Klanten',
  'details.locations':    'Details — Locaties',
  'details.departments':  'Details — Afdelingen',
  'details.orders':       'Details — Diensten',
  'details.contacts':     'Details — Contactpersonen',
  'details.runs':         'Details — Uitvoeringen',
  'details.messages':     'Details — Berichten',
  settings:               'Instellingen',
  users:                  'Gebruikers',
  profile:                'Profiel',
}

// Tijdelijke placeholder voor pagina's die nog gebouwd worden
function PlaceholderPage({ title }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="font-mono text-sm text-gray-400">{title} — komt eraan</p>
    </div>
  )
}

/**
 * useTenantTheme
 * Past CSS-variabelen toe op basis van tenant-branding.
 * Backend moet { primary_color, logo_url } teruggeven via /api/auth/me.
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
 * DashboardLayout
 * Hoofdlayout na inloggen:
 * [Linker nav] [Topbar + Content] [Rechter filterpanel (optioneel)]
 */
function DashboardLayout() {
  const [expanded,       setExpanded]       = useState(true)
  const [activePage,     setActivePage]     = useState('dashboard')
  const [rightPanelOpen, setRightPanelOpen] = useState(false)
  const { logout, user }                    = useAuth()
  const { filterGroups }                    = useRightPanel()

  // Tenant-info uit user object (backend vult dit via /api/auth/me)
  const tenant = user?.tenant ?? { name: user?.tenant_id ?? 'Koios Connect', logo_url: null }
  useTenantTheme(tenant)

  // Filterpanel-knop alleen tonen als huidige pagina filters heeft geregistreerd
  const hasFilters    = filterGroups.length > 0
  const activeFilters = filterGroups.reduce((sum, g) => sum + (g.selected?.length ?? 0), 0)

  // Rendert de juiste pagina-component op basis van activePage-sleutel
  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':           return <Dashboard />
      case 'candidates':          return <CandidatesReport initialTab="candidates" />
      case 'customers':           return <CustomerReport />
      case 'locations':           return <LocationsReport />
      case 'departments':         return <DepartmentsReport />
      case 'workflows':           return <WorkflowsPage />
      case 'whatsapp':            return <PlaceholderPage title="WhatsApp" />
      case 'details.candidates':  return <CandidatesDetailPage />
      case 'details.customers':   return <CustomersDetailPage />
      case 'details.locations':   return <LocationsDetailPage />
      case 'details.departments': return <DepartmentsDetailPage />
      case 'details.contacts':    return <ContactsDetailPage />
      case 'details.orders':      return <OrdersReport />
      case 'profile':             return <ProfilePage />
      case 'users':               return <UsersPage />
      case 'details.runs':        return <RunsDetailPage />
      case 'details.messages':    return <MessagesDetailPage />
      case 'settings':            return <SettingsPage />
      default:                    return <PlaceholderPage title={PAGE_TITLES[activePage] || activePage} />
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── Linker navigatie ── */}
      <Sidebar
        expanded={expanded}
        setExpanded={setExpanded}
        activePage={activePage}
        setActivePage={setActivePage}
        onTheme={() => {}}
      />

      {/* ── Rechter kolom: topbar + content + filterpanel ── */}
      <div className="kc-main-bg flex flex-col flex-1 overflow-hidden" style={{ background: 'var(--bg)' }}>

        {/* Topbar */}
        <div
          className="kc-topbar flex items-center flex-shrink-0 gap-3 px-5"
          style={{ height: 52, background: 'var(--topbar-bg)', borderBottom: '1px solid var(--border)' }}
        >
          {/* Tenant logo of initiaal-avatar + naam */}
          <div className="flex items-center flex-shrink-0 gap-2">
            {tenant?.logo_url
              ? <img src={tenant.logo_url} alt="" style={{ height: 22, borderRadius: 4 }} />
              : (
                <div
                  className="flex items-center justify-center flex-shrink-0 rounded-md"
                  style={{
                    width: 22, height: 22,
                    background: 'var(--color-primary)',
                    fontSize: 11, color: 'white', fontWeight: 700,
                  }}
                >
                  {(tenant?.name ?? 'K').charAt(0).toUpperCase()}
                </div>
              )
            }
            <span className="font-semibold text-gray-900" style={{ fontSize: 13 }}>
              {tenant?.name ?? 'Koios Connect'}
            </span>
          </div>

          {/* Broodkruimel-separator + paginatitel */}
          <span style={{ color: 'var(--border)', fontSize: 16 }}>›</span>
          <span className="font-medium truncate" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {PAGE_TITLES[activePage] || activePage}
          </span>

          {/* Rechter acties */}
          <div className="flex items-center flex-shrink-0 gap-2 ml-auto">
            {/* Avatar knop — navigeert naar profielpagina */}
            {(() => {
              const initials = (
                [user?.firstname, user?.lastname].filter(Boolean).map(n => n[0]).join('').toUpperCase()
                || (user?.name ?? '').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
                || (user?.email ?? '').slice(0, 2).toUpperCase()
                || '?'
              )
              return (
                <button
                  onClick={() => setActivePage('profile')}
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

            {/* Filterknop — alleen zichtbaar als pagina filters heeft geregistreerd */}
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

        {/* Content-rij: pagina + optioneel rechter filterpanel naast elkaar */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-auto">
            {renderPage()}
          </div>

          {/* Rechter filterpanel — zelfde hoogte als content, schuift naast de pagina */}
          {rightPanelOpen && hasFilters && (
            <div
              className="kc-right-panel flex-shrink-0 overflow-y-auto"
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

// Beschermt routes — redirect naar /login als niet ingelogd
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

// Blokkeert ingelogde users van de loginpagina
function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/" replace /> : children
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        {/* RightPanelProvider binnen AuthProvider zodat componenten
            zowel auth als filterpanel context kunnen gebruiken */}
        <RightPanelProvider>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/*"     element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>} />
          </Routes>
        </RightPanelProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}