import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'

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
const AppsContext = createContext(null)

// Integration connectors (external planning APIs). WhatsApp and AI Agent are
// NOT here — they are modules managed via the Modules settings tab (accessible_pages).
// These apps are only available to tenants on package 3 ("Alles").
export const AVAILABLE_APPS = [
  {
    id:          'shiftmanager',
    label:       'ShiftManager API',
    description: 'Koppeling met ShiftManager voor diensten, planning en kandidaten.',
    icon:        '🗂️',
    color:       '#1D4ED8',
    bg:          '#EFF6FF',
    border:      '#BFDBFE',
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
    bg:          '#FFFBEB',
    border:      '#FDE68A',
    monthly:     true,
  },
]

export function AppsProvider({ children }) {
  // List of enabled app IDs. Seeded synchronously from the localStorage cache so
  // the UI doesn't flicker on load, then refreshed from the server below.
  const [enabled, setEnabled] = useState(() => {
    try { return JSON.parse(localStorage.getItem('enabled_apps') ?? '[]') } catch { return [] }
  })
  const [loading, setLoading] = useState(true)

  // Fetch the authoritative enabled-apps list once on mount and update the cache.
  // Backend contract: GET /settings/apps returns { enabled: ["whatsapp", ...] }.
  useEffect(() => {
    if (!localStorage.getItem('auth_token')) {
      setLoading(false)
      return
    }
    api.get('/settings/apps')
      .then(res => {
        const list = res.data?.enabled ?? res.data ?? []
        setEnabled(Array.isArray(list) ? list : [])
        localStorage.setItem('enabled_apps', JSON.stringify(list))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // True if the given app ID is currently enabled (used to gate UI/modules).
  const isAppEnabled = (appId) => enabled.includes(appId)

  // Replace the enabled list (called by Settings after a successful PUT) and cache it.
  const setApps = (newEnabled) => {
    setEnabled(newEnabled)
    localStorage.setItem('enabled_apps', JSON.stringify(newEnabled))
  }

  return (
    <AppsContext.Provider value={{ enabled, setApps, isAppEnabled, loading }}>
      {children}
    </AppsContext.Provider>
  )
}

// Convenience hook for components: useApps() instead of useContext(AppsContext).
export const useApps = () => useContext(AppsContext)
