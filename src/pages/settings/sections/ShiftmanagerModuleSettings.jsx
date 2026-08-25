/**
 * Shiftmanager module settings — TWO sub-tabs (Danny 04-08: "moeten dan onder
 * Shiftmanager 2 subtabjes worden" — "should then become 2 sub-tabs under
 * Shiftmanager"): KPI targets and display limits, each on
 * their own sub-tab instead of stacked. Labels reuse the schemas' own already-
 * translated titles (smKpis.title / display.title) so there is one source of
 * truth for each section's name. The manual Sync tab is retired (SYNC-RETIRE-1
 * — the daily sm:sync-all cron replaced it; the emergency trigger stays on the
 * SM pages' SmSyncButton).
 *
 * SM-MODULE-TABS-1 (Danny 16-08 restore): reachability hangs on TWO independent
 * superadmin toggles — Modules → "Rapportage Shiftmanager" ("Shiftmanager
 * reporting", 'sm', hasModule) and
 * Apps → the Shiftmanager connector ('shiftmanager', isAppEnabled) — the settings
 * nav item is gated on EITHER (registry.jsx `requiresModuleOrApp`, see
 * SettingsPage's passesModuleOrApp). Inside this screen, both existing sub-tabs
 * back the REPORTING dashboards only (KPI targets feed the SM dashboard; display
 * limits feed CandidatesReport/ShiftmanagerDashboard — all module-gated pages) —
 * there is no app-only content since the Sync tab retired. So the tab SET follows
 * the module flag; an app-only tenant still reaches the screen (nav gate) but
 * sees an honest "nothing here yet" notice instead of both tabs.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useApps } from '@/context/AppsContext'
import SubTabBar from '@/components/drawer/SubTabBar'
import SchemaSection from '../components/SchemaSection'
import displaySchema from '../schemas/display'
import smKpisSchema from '../schemas/smKpis'

export default function ShiftmanagerModuleSettings() {
  const { t } = useTranslation('settings')
  const { hasModule } = useAuth()
  const { isAppEnabled } = useApps() ?? {}

  // Active sub-tab: KPI targets first, display limits second.
  const [activeTab, setActiveTab] = useState('kpis')

  // Both tabs back reporting-only content — no module means no tabs to show.
  const moduleOn = hasModule('sm')
  const appOn = isAppEnabled ? isAppEnabled('shiftmanager') : false

  // Deep-link / app-only guard: distinguish "reachable via the app flag but the
  // reporting module is off" (accurate notice) from "neither flag on" (the
  // registry already hides the nav item, so this is a defensive fallback only).
  if (!moduleOn) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        {appOn ? t('modShiftmanager.reportingOff') : t('shell.empty')}
      </p>
    )
  }

  const tabs = [
    { id: 'kpis', label: t('smKpis.title') },
    { id: 'display', label: t('display.title') },
  ]

  // One sub-tab renders at a time, via the shared underline SubTabBar.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SubTabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />
      {activeTab === 'kpis' && <SchemaSection schema={smKpisSchema} />}
      {activeTab === 'display' && <SchemaSection schema={displaySchema} />}
    </div>
  )
}
