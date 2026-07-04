import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import api from '../lib/api'
import { useAuth } from './AuthContext'

/**
 * AppsContext — which paid add-on "apps" are enabled for the current tenant.
 *
 * Drives two things in the UI:
 *   1. The Apps section in Settings (toggle on/off).
 *   2. Module visibility in the workflow builder (a module only shows if its
 *      required app is enabled — see MODULE_APP_MAP in modules/index.js).
 *
 * NOTE: this is UI gating only. The backend must reject calls to disabled apps;
 * a user can edit the cached list in localStorage.
 */

// One integration connector shown in the Apps settings.
export interface AppDef {
  id: string
  label: string
  description: string
  icon: string
  color: string
  bg: string
  border: string
  monthly: boolean
}

interface AppsValue {
  enabled: string[]
  setApps: (newEnabled: string[]) => void
  isAppEnabled: (appId: string) => boolean
  loading: boolean
}

const AppsContext = createContext<AppsValue | null>(null)

// Integration connectors (external planning APIs). WhatsApp and AI Agent are
// NOT here — they are modules managed via the Modules settings tab (accessible_pages).
// These apps are only available to tenants on package 3 ("Alles").
export const AVAILABLE_APPS: AppDef[] = [
  {
    id:          'shiftmanager',
    label:       'ShiftManager API',
    description: 'Koppeling met ShiftManager voor diensten, planning en kandidaten.',
    icon:        '🗂️',
    color:       '#1D4ED8',
    bg:          'var(--color-secondary-bg)',
    border:      '#BFDBFE',
    monthly:     true,
  },
  {
    id:          'helloflex',
    label:       'HelloFlex',
    description: 'Backoffice-koppeling met HelloFlex (verloning, facturatie, contracten).',
    icon:        '🟡',
    color:       '#CA8A04',
    bg:          'var(--color-warning-bg)',
    border:      '#FDE68A',
    monthly:     true,
  },
  {
    id:          'intus',
    label:       'Intus',
    description: 'Koppeling met Intus planning voor het ophalen van diensten en kandidaten.',
    icon:        '📅',
    color:       '#0369A1',
    bg:          '#F0F9FF',
    border:      '#BAE6FD',
    monthly:     true,
  },
  {
    id:          'aelio',
    label:       'Aelio',
    description: 'Koppeling met Aelio voor dienstenbeheer en personeelsplanning.',
    icon:        '🗓️',
    color:       '#0F766E',
    bg:          '#F0FDFA',
    border:      '#99F6E4',
    monthly:     true,
  },
  {
    id:          'elanza',
    label:       'Elanza',
    description: 'Koppeling met Elanza voor diensten en kandidaatbeheer.',
    icon:        '📋',
    color:       '#B45309',
    bg:          'var(--color-warning-bg)',
    border:      '#FDE68A',
    monthly:     true,
  },
]

export function AppsProvider({ children }: { children: ReactNode }) {
  // List of enabled app IDs. Seeded synchronously from the localStorage cache so
  // the UI doesn't flicker on load, then refreshed from the server below.
  const [enabled, setEnabled] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('enabled_apps') ?? '[]') as string[] } catch { return [] }
  })
  const [loading, setLoading] = useState(true)
  // Session state gates the fetch — the provider mounts before login (App shell order).
  const { user } = useAuth() ?? {}

  // Fetch the authoritative enabled-apps list once on mount and update the cache.
  // Backend contract: GET /settings/apps returns { enabled: ["whatsapp", ...] }.
  useEffect(() => {
    // No session yet → cached/default apps and stay quiet (no pre-login 401);
    // the effect re-runs the moment the user logs in (or switches tenant).
    if (!user) { setLoading(false); return }
    api.get('/settings/apps')
      .then(res => {
        const list = res.data?.enabled ?? res.data ?? []
        setEnabled(Array.isArray(list) ? list : [])
        localStorage.setItem('enabled_apps', JSON.stringify(list))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch per login/tenant-switch
  }, [user?.id])

  // True if the given app ID is currently enabled (used to gate UI/modules).
  const isAppEnabled = (appId: string) => enabled.includes(appId)

  // Replace the enabled list (called by Settings after a successful PUT) and cache it.
  const setApps = (newEnabled: string[]) => {
    setEnabled(newEnabled)
    localStorage.setItem('enabled_apps', JSON.stringify(newEnabled))
  }

  const value: AppsValue = { enabled, setApps, isAppEnabled, loading }
  return <AppsContext.Provider value={value}>{children}</AppsContext.Provider>
}

// Convenience hook for components: useApps() instead of useContext(AppsContext).
export function useApps(): AppsValue | null {
  return useContext(AppsContext)
}
