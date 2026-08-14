/**
 * AuthContext — dashboardType() precedence (DASHBOARD-KIEZER-1 chain audit).
 *
 * dashboardType() used to return the FIRST role that carried a dashboard_type.
 * But /auth/me (backend AuthPayloadService) never sorts roles by precedence — it
 * just maps the user's roles in whatever order Eloquent returns them — so a user
 * holding BOTH 'recruitment' and 'recruitment_manager' could land on the poorer
 * own-scoped recruiter dashboard purely by DB row order, exactly backwards from
 * the intent of TYPE_PRECEDENCE ("the richest dashboard wins", templates.ts).
 * This now resolves through the SAME resolveDashboardType() the rest of the
 * dashboard-type chain (switcher/DashboardLayout) uses.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { AuthProvider, useAuth } from './AuthContext'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

afterEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('AuthContext · dashboardType() precedence', () => {
  it('picks recruitment_manager over recruitment when a user holds both roles, regardless of list order', async () => {
    // The "there was a session" hint — without it the boot probe is skipped entirely.
    localStorage.setItem('km_session', '1')
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/auth/me') {
        return Promise.resolve({
          data: {
            user: {
              id: 'u1',
              // Deliberately lists the OWN-SCOPED role FIRST — "first role wins"
              // would (wrongly) resolve to 'recruitment' here.
              roles: [
                { name: 'recruiter', dashboard_type: 'recruitment' },
                { name: 'manager', dashboard_type: 'recruitment_manager' },
              ],
            },
          },
        })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current?.loading).toBe(false))
    expect(result.current?.dashboardType()).toBe('recruitment_manager')
  })

  it('falls back to readonly when the user carries no dashboard_type at all', async () => {
    localStorage.setItem('km_session', '1')
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/auth/me') return Promise.resolve({ data: { user: { id: 'u2', roles: [] } } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current?.loading).toBe(false))
    expect(result.current?.dashboardType()).toBe('readonly')
  })
})
