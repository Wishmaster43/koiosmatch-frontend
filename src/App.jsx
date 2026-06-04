import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import WorkflowsPage from './pages/Workflows'
import Reports from './pages/Reports'
import Sidebar from './components/layout/Sidebar'
import { useState } from 'react'
import './index.css'

const PAGE_TITLES = {
  dashboard:            'Dashboard',
  workflows:            'Werkstromen',
  candidates:           'Kandidaten',
  shifts:               'Diensten',
  whatsapp:             'WhatsApp',
  reports:              'Rapportages',
  'reports.candidates': 'Rapportages — Kandidaten',
  'reports.messages':   'Rapportages — Berichten',
  'reports.shifts':     'Rapportages — Diensten',
  'reports.runs':       'Rapportages — Uitvoeringen',
  settings:             'Instellingen',
  users:                'Gebruikers',
  profile:              'Profiel',
}

function PlaceholderPage({ title }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="font-mono text-sm text-gray-400">{title} — komt eraan</p>
    </div>
  )
}

function DashboardLayout() {
  const [expanded,   setExpanded]   = useState(true)
  const [activePage, setActivePage] = useState('dashboard')
  const { logout, user }            = useAuth()

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':           return <Dashboard />
      case 'workflows':           return <WorkflowsPage />
      case 'reports':
      case 'reports.candidates':  return <Reports initialTab="candidates" />
      case 'reports.messages':    return <Reports initialTab="messages" />
      case 'reports.shifts':      return <Reports initialTab="shifts" />
      case 'reports.runs':        return <Reports initialTab="runs" />
      default:                    return <PlaceholderPage title={PAGE_TITLES[activePage] || activePage} />
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        expanded={expanded}
        setExpanded={setExpanded}
        activePage={activePage}
        setActivePage={setActivePage}
        onTheme={() => {}}
      />
      <div className="flex flex-col flex-1 overflow-hidden" style={{ background: '#F5F5F7' }}>
        <div
          className="flex items-center flex-shrink-0 px-5"
          style={{ height: 52, background: 'white', borderBottom: '1px solid #F3F4F6' }}
        >
          <span className="font-medium text-gray-800" style={{ fontSize: 14 }}>
            {PAGE_TITLES[activePage] || activePage}
          </span>
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-xs text-gray-400">{user?.name}</span>
            <button
              onClick={logout}
              className="text-xs rounded-md px-3 py-1.5"
              style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280' }}
            >
              Uitloggen
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {renderPage()}
        </div>
      </div>
    </div>
  )
}

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

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/" replace /> : children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/*" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}