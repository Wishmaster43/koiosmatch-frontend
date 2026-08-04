import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import SubTabBar from '@/components/drawer/SubTabBar'
import SchemaSection from '../components/SchemaSection'
import displaySchema from '../schemas/display'
import smKpisSchema from '../schemas/smKpis'

/**
 * Shiftmanager module settings — TWO sub-tabs (Danny 04-08: "moeten dan onder
 * Shiftmanager 2 subtabjes worden"): KPI targets and display limits, each on
 * their own sub-tab instead of stacked. Labels reuse the schemas' own already-
 * translated titles (smKpis.title / display.title) so there is one source of
 * truth for each section's name. The manual Sync tab is retired (SYNC-RETIRE-1
 * — the daily sm:sync-all cron replaced it; the emergency trigger stays on the
 * SM pages' SmSyncButton). Reachability is registry-gated on the 'sm' module
 * (→ Modules).
 */
export default function ShiftmanagerModuleSettings() {
  const { t } = useTranslation('settings')
  const { hasModule } = useAuth()

  // Active sub-tab: KPI targets first, display limits second.
  const [activeTab, setActiveTab] = useState('kpis')

  // Defensive guard for direct deep links — the registry already hides the tab.
  if (!hasModule('sm')) {
    return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('shell.empty')}</p>
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
