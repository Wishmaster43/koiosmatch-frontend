import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useApps } from '@/context/AppsContext'
import SchemaSection from '../components/SchemaSection'
import SyncSettings from './SyncSettings'
import displaySchema from '../schemas/display'
import smKpisSchema from '../schemas/smKpis'

// Sub-tabs inside the Shiftmanager module (SM-MODULE-TABS-1, Danny 2026-07-16).
// KPIs + Display configure the *Rapportage ShiftManager* dashboard → gated on the
// tenant module ('sm'). Sync pulls LIVE data through the ShiftManager API
// connector (/sm_candidates/sync, /sm_customers/sync) → gated on the ShiftManager
// app/koppeling flag, since that call only makes sense with the connector on.
// This module-vs-app split per tab is a documented judgement call (the backend
// contract only guarantees the two flags arrive separately) — flip a `gate` here
// if product/backend assign a tab to the other side.
const SUBTABS = [
  { id: 'kpis',    labelKey: 'nav.kpis',    gate: 'module' },
  { id: 'display', labelKey: 'nav.display', gate: 'module' },
  { id: 'sync',    labelKey: 'nav.sync',    gate: 'app' },
]

// Pure gating matrix, exported so the module/app/both/neither combinations are
// unit-testable without mounting the schema-heavy tab bodies.
export function visibleShiftmanagerTabs({ moduleOn, appOn }) {
  return SUBTABS.filter(s => (s.gate === 'module' ? moduleOn : appOn))
}

/**
 * Shiftmanager module settings — sub-tabbed: KPIs / Display limits / Sync. The
 * section itself is only reachable when the registry's requiresModuleOrApp gate
 * passes (module 'sm' OR the ShiftManager app); within it, each tab additionally
 * hides itself if ITS OWN flag is off, so "only the app is on" shows just Sync.
 */
export default function ShiftmanagerModuleSettings() {
  const { t } = useTranslation('settings')
  const { hasModule } = useAuth()
  const { isAppEnabled, loading: appsLoading } = useApps() ?? {}
  const moduleOn = hasModule('sm')
  const appOn = isAppEnabled ? isAppEnabled('shiftmanager') : false
  const tabs = useMemo(() => visibleShiftmanagerTabs({ moduleOn, appOn }), [moduleOn, appOn])
  const [sub, setSub] = useState(tabs[0]?.id ?? null)

  // Keep the active tab valid as the visible set changes (tenant switch, app toggle,
  // or the AppsContext finishing its async load after the module flag already resolved).
  useEffect(() => {
    if (tabs.length > 0 && !tabs.some(s => s.id === sub)) setSub(tabs[0].id)
  }, [tabs, sub])

  return (
    <div>
      {/* Sub-tab bar (one level below the Modules tab). */}
      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 24, overflowX: 'auto' }}>
        {tabs.map(s => {
          const active = s.id === sub
          return (
            <button key={s.id} role="tab" aria-selected={active} onClick={() => setSub(s.id)}
              style={{ padding: '9px 12px', border: 'none', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap',
                fontSize: 13, fontWeight: active ? 600 : 500, color: active ? 'var(--color-primary)' : 'var(--text-muted)',
                borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'transparent'}`, marginBottom: -1 }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}>
              {t(s.labelKey)}
            </button>
          )
        })}
      </div>

      {/* Empty state: only reachable mid-flicker (AppsContext still loading the app
          flag) since the section itself requires module-or-app to be reached at all. */}
      {tabs.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {appsLoading ? t('common.loadingShort') : t('shell.empty')}
        </p>
      )}

      {sub === 'kpis' && <SchemaSection schema={smKpisSchema} />}
      {sub === 'display' && <SchemaSection schema={displaySchema} />}
      {sub === 'sync' && <SyncSettings />}
    </div>
  )
}
