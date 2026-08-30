/**
 * Shiftmanager module settings — INTEGRATIONS-SETTINGS-1 (Danny 31-08: "onder
 * kopje integratie en dan kopje shiftmanager met eigen subtabjes"): the section
 * now fronts the CONNECTOR — Connection and Mapping speak the live
 * INTEGRATIONS-CONTRACT endpoints and are available on EITHER superadmin toggle
 * (module 'sm' OR app 'shiftmanager'), while the two original reporting
 * sub-tabs (KPI targets, display limits — Danny 04-08) stay module-only, since
 * they feed the reporting dashboards (SM-MODULE-TABS-1). Neither flag on =
 * the calm empty state (the registry already hides the nav item; deep-link guard).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useApps } from '@/context/AppsContext'
import SubTabBar from '@/components/drawer/SubTabBar'
import SchemaSection from '../components/SchemaSection'
import displaySchema from '../schemas/display'
import smKpisSchema from '../schemas/smKpis'
import IntegrationConnectionCard from './integrations/IntegrationConnectionCard'
import IntegrationMappingsTable from './integrations/IntegrationMappingsTable'

// Connector front door first; reporting tabs only with the module on.
export default function ShiftmanagerModuleSettings() {
  const { t } = useTranslation('settings')
  const { hasModule } = useAuth()
  const { isAppEnabled } = useApps() ?? {}

  const moduleOn = hasModule('sm')
  const appOn = isAppEnabled ? isAppEnabled('shiftmanager') : false

  // Active sub-tab: the connection tab is the connector's front door.
  const [activeTab, setActiveTab] = useState('koppeling')

  // Deep-link guard: with neither flag on there is nothing to show (the
  // registry hides the nav item; this is the defensive fallback only).
  if (!moduleOn && !appOn) {
    return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('shell.empty')}</p>
  }

  // Connection + mapping ride on either flag; KPI/display stay reporting-module-only.
  const tabs = [
    { id: 'koppeling', label: t('integrations.tabs.connection') },
    { id: 'mapping', label: t('integrations.tabs.mapping') },
    ...(moduleOn ? [
      { id: 'kpis', label: t('smKpis.title') },
      { id: 'display', label: t('display.title') },
    ] : []),
  ]

  // One sub-tab renders at a time, via the shared underline SubTabBar.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SubTabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />
      {activeTab === 'koppeling' && <IntegrationConnectionCard connector="shiftmanager" />}
      {activeTab === 'mapping' && <IntegrationMappingsTable connector="shiftmanager" domains={['functie']} />}
      {moduleOn && activeTab === 'kpis' && <SchemaSection schema={smKpisSchema} />}
      {moduleOn && activeTab === 'display' && <SchemaSection schema={displaySchema} />}
    </div>
  )
}
