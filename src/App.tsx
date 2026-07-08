/**
 * App.tsx — application root: providers, the auth guard and the top-level routes.
 * The post-login shell lives in components/layout/DashboardLayout; the page
 * registry (lazy imports + renderPage + titles) in components/layout/appPages.
 */
import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider }                    from '@tanstack/react-query'
import { queryClient }                            from './lib/queryClient'
import { AuthProvider, useAuth }                  from './context/AuthContext'
import { RightPanelProvider }                     from './context/RightPanelContext'
import { ThemeProvider }                          from './context/ThemeContext'
import { AppsProvider }                           from './context/AppsContext'
import { LookupsProvider }                        from './context/LookupsContext'
import ErrorBoundary                              from '@/components/ui/ErrorBoundary'
import Toaster                                    from '@/components/ui/Toaster'
import LoginPage                                  from './pages/auth/LoginPage'
import DashboardLayout                            from './components/layout/DashboardLayout'
import './index.css'

// Lazy: only users blocked by tenant-wide MFA enforcement ever load this screen.
const MfaEnrollmentGate = lazy(() => import('./pages/auth/MfaEnrollmentGate'))

// Boot loader — shown while the auth context resolves (and as Suspense fallback).
function BootLoader() {
  return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-center rounded-xl animate-pulse"
          style={{ width: 40, height: 40, background: 'var(--color-primary)' }}>
          <span style={{ color: 'white', fontSize: 18 }}>⚡</span>
        </div>
        <p className="text-sm text-[var(--text-muted)]">Laden...</p>
      </div>
    </div>
  )
}

// Guards authenticated routes — redirects to /login when not logged in.
function ProtectedRoute({ children }: { children: ReactNode }) {
  // Defensive: tolerate a null auth context (provider not ready, or an upstream
  // failure like /auth/me 500'ing) — show the loader instead of crashing the tree.
  const auth = useAuth()
  if (!auth || auth.loading) return <BootLoader />
  // Tenant-wide MFA enforcement (mfa.enforced): /auth/me flags the user with
  // mfa_setup_required — block the whole app behind the enrollment gate until
  // MFA is set up (the server 403s every other call anyway).
  if (auth.user?.mfa_setup_required && auth.user.mfa_enabled !== true) {
    return <Suspense fallback={<BootLoader />}><MfaEnrollmentGate /></Suspense>
  }
  return auth.user ? <>{children}</> : <Navigate to="/login" replace />
}

// Blocks authenticated users from the login page.
function PublicRoute({ children }: { children: ReactNode }) {
  const auth = useAuth()
  if (!auth || auth.loading) return null
  return auth.user ? <Navigate to="/" replace /> : <>{children}</>
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
          {/* App-wide toast host — outside the boundary so it survives a page crash. */}
          <Toaster />
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
