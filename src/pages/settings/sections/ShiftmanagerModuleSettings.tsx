/**
 * Shiftmanager module settings — INTEGRATIONS-SETTINGS-1 (Danny 31-08: "under
 * the integrations heading, then a Shiftmanager heading with its own sub-tabs"): the section
 * fronts the CONNECTOR (Connection), the two reporting sub-tabs (KPI
 * targets, display limits — Danny 04-08) and the Links table. ONIX G-012: every tab keys on module
 * 'sm' only (the legacy app arm is gone); module off = the calm empty state.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import ConnectorTabsShell from './integrations/ConnectorTabsShell'
import SchemaSection, { type Schema } from '../components/SchemaSection'
import displaySchema from '../schemas/display'
import smKpisSchema from '../schemas/smKpis'
import IntegrationConnectionCard from './integrations/IntegrationConnectionCard'
import IntegrationLinksPanel from './integrations/links/IntegrationLinksPanel'

// Connector front door first; reporting tabs only with the module on.
export default function ShiftmanagerModuleSettings() {
  const { t } = useTranslation('settings')
  const auth = useAuth()

  const moduleOn = auth?.hasModule('sm') ?? false

  // Active sub-tab: the connection tab is the connector's front door.
  const [activeTab, setActiveTab] = useState('connection')

  // Deep-link guard: the module is the only truth (ONIX G-012); without it there is nothing to show.
  if (!moduleOn) {
    return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('shell.empty')}</p>
  }

  // ONIX G-012: no Mapping tab for Shiftmanager, because the SM side reads no
  // mapping store yet (BE fact); helloflex/werkzoeken keep theirs.
  const tabs = [
    { id: 'connection', label: t('integrations.tabs.connection') },
    { id: 'kpis', label: t('smKpis.title') },
    { id: 'display', label: t('display.title') },
    { id: 'links', label: t('integrations.tabs.links') },
  ]

  // One sub-tab renders at a time, via the shared underline SubTabBar.
  return (
    <ConnectorTabsShell tabs={tabs} active={activeTab} onChange={setActiveTab}>
      {activeTab === 'connection' && <IntegrationConnectionCard connector="shiftmanager" />}
      {/* The .js schema literals are untyped and only structurally close to Schema — cast, don't retype the shared .js source (out of this task's scope). */}
      {activeTab === 'kpis' && <SchemaSection schema={smKpisSchema as Schema} />}
      {activeTab === 'display' && <SchemaSection schema={displaySchema as Schema} />}
      {activeTab === 'links' && <IntegrationLinksPanel system="shiftmanager" />}
    </ConnectorTabsShell>
  )
}
