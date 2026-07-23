import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode, ComponentType } from 'react'
import api from '../lib/api'
import { useAuth } from './AuthContext'
// Real brand logos (local assets, §7 CSP) for the connectors that have one.
import helloflexLogo from '@/assets/integrations/helloflex.png'
import shiftmanagerLogo from '@/assets/integrations/shiftmanager.png'
import aelioLogo from '@/assets/integrations/aelio.png'
import intusLogo from '@/assets/integrations/intus.png'
import sdbLogo from '@/assets/integrations/sdb.png'
import elanzaLogo from '@/assets/integrations/elanza.png'
import onsLogo from '@/assets/integrations/ons.png'
import easyflexLogo from '@/assets/integrations/easyflex.png'
import afasLogo from '@/assets/integrations/afas.png'

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
  // APPS-GROUPS-1 (Danny 23-07): the settings subtab this connector lives under.
  group: 'planning' | 'backoffice' | 'koios_ai'
  // Real brand image (local asset) — rendered instead of the emoji when present.
  image?: string
  // Crisp vector mark component (preferred over image when the system's favicon is tiny).
  Mark?: ComponentType<{ size?: number }>
  // Not built yet: the toggle renders greyed-out + a "binnenkort" chip (honest, §3).
  comingSoon?: boolean
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
// Each connector carries its own distinguishing brand colour (icon/border/bg) —
// seed DATA mirroring the external system's own palette, not UI styling.
/* eslint-disable no-restricted-syntax -- seed DATA hex: connector brand palette, not UI styling */
export const AVAILABLE_APPS: AppDef[] = [
  // ---- Planning (volgorde Danny 23-07) --------------------------------------
  {
    id:          'shiftmanager',
    label:       'Shiftmanager',
    description: 'Koppeling met Shiftmanager voor diensten, planning en kandidaten.',
    icon:        '🗂️',
    image:       shiftmanagerLogo,
    group:       'planning',
    color:       '#E11D2A',
    bg:          '#FDECEC',
    border:      '#FECACA',
    monthly:     true,
  },
  {
    id:          'aelio',
    label:       'Aelio',
    description: 'Koppeling met Aelio voor dienstenbeheer en personeelsplanning.',
    icon:        '🗓️',
    group:       'planning',
    image:       aelioLogo,
    color:       '#0F766E',
    bg:          '#F0FDFA',
    border:      '#99F6E4',
    monthly:     true,
  },
  {
    id:          'intus',
    label:       'Intus',
    description: 'Koppeling met Intus planning voor het ophalen van diensten en kandidaten.',
    icon:        '📅',
    group:       'planning',
    image:       intusLogo,
    color:       '#0369A1',
    bg:          '#F0F9FF',
    border:      '#BAE6FD',
    monthly:     true,
  },
  {
    id:          'sdb',
    label:       'SDB planning',
    description: 'Koppeling met SDB planning voor diensten en roosters.',
    icon:        '🗓️',
    group:       'planning',
    image:       sdbLogo,
    color:       '#7E22CE',
    bg:          '#FAF5FF',
    border:      '#E9D5FF',
    monthly:     true,
    comingSoon:  true,
  },
  {
    id:          'elanza',
    label:       'Elanza',
    description: 'Koppeling met Elanza voor diensten en kandidaatbeheer.',
    icon:        '📋',
    group:       'planning',
    image:       elanzaLogo,
    color:       '#B45309',
    bg:          'var(--color-warning-bg)',
    border:      '#FDE68A',
    monthly:     true,
  },
  {
    id:          'ons',
    label:       'ONS',
    description: 'Koppeling met ONS (Nedap) voor planning en roosters.',
    icon:        '📆',
    group:       'planning',
    image:       onsLogo,
    color:       '#334155',
    bg:          '#F8FAFC',
    border:      '#E2E8F0',
    monthly:     true,
    comingSoon:  true,
  },
  // ---- Backoffice ------------------------------------------------------------
  {
    // APPS-HF-SLUG-1 (Danny 23-07 "aanzetten gaat fout"): the connector id MUST be
    // 'hf' — the backend allow-list (ModuleSettingController::VALID_APPS) and the
    // module flag both use the §10 hf-slug; 'helloflex' 422'd on every toggle.
    id:          'hf',
    label:       'HelloFlex',
    description: 'Backoffice-koppeling met HelloFlex (verloning, facturatie, contracten).',
    icon:        '🟡',
    image:       helloflexLogo,
    group:       'backoffice',
    color:       '#CA8A04',
    bg:          'var(--color-warning-bg)',
    border:      '#FDE68A',
    monthly:     true,
  },
  {
    id:          'easyflex',
    label:       'EasyFlex',
    description: 'Backoffice-koppeling met EasyFlex (verloning en facturatie).',
    icon:        '💶',
    group:       'backoffice',
    image:       easyflexLogo,
    color:       '#0E7490',
    bg:          '#ECFEFF',
    border:      '#A5F3FC',
    monthly:     true,
    comingSoon:  true,
  },
  {
    id:          'afas',
    label:       'AFAS',
    description: 'Backoffice-koppeling met AFAS (HRM, verloning en facturatie).',
    icon:        '🧾',
    group:       'backoffice',
    image:       afasLogo,
    color:       '#1D4ED8',
    bg:          'var(--color-secondary-bg)',
    border:      '#BFDBFE',
    monthly:     true,
    comingSoon:  true,
  },
  // ---- Koios AI --------------------------------------------------------------
  // AI-agent apps (Danny 2026-07-08): these gate the matching workflow-folder
  // visibility server-side (FolderVisibility) — toggle off = folder + workflows hidden.
  {
    id:          'ai_planner',
    label:       'AI Planner',
    description: 'AI-planner: diensten aanbieden, reminders, gewerkte diensten en statuswijzigingen. Toont de map "AI Planner" in Workflows.',
    icon:        '🤖',
    group:       'koios_ai',
    color:       '#7C3AED',
    bg:          '#F5F3FF',
    border:      '#DDD6FE',
    monthly:     true,
  },
  {
    id:          'ai_recruiter',
    label:       'AI Recruiter',
    description: 'AI-recruiter: kennismaking en automatische reacties op kandidaat-berichten. Toont de map "AI Recruiter" in Workflows.',
    icon:        '🎯',
    group:       'koios_ai',
    color:       '#DB2777',
    bg:          '#FDF2F8',
    border:      '#FBCFE8',
    monthly:     true,
  },
]
/* eslint-enable no-restricted-syntax */

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
