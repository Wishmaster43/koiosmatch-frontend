/**
 * Shiftmanager module settings — INTEGRATIONS-SETTINGS-1 (Danny 31-08: "under
 * the integrations heading, then a Shiftmanager heading with its own sub-tabs"): the section
 * fronts the CONNECTOR (Connection) plus the two reporting sub-tabs (KPI
 * targets, display limits — Danny 04-08). ONIX G-012: every tab keys on module
 * 'sm' only (the legacy app arm is gone); module off = the calm empty state.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import SubTabBar from '@/components/drawer/SubTabBar'
import SchemaSection, { type Schema } from '../components/SchemaSection'
import displaySchema from '../schemas/display'
import smKpisSchema from '../schemas/smKpis'
import IntegrationConnectionCard from './integrations/IntegrationConnectionCard'

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
  ]

  // One sub-tab renders at a time, via the shared underline SubTabBar.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SubTabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />
      {activeTab === 'connection' && <IntegrationConnectionCard connector="shiftmanager" />}
      {/* The .js schema literals are untyped and only structurally close to Schema — cast, don't retype the shared .js source (out of this task's scope). */}
      {activeTab === 'kpis' && <SchemaSection schema={smKpisSchema as Schema} />}
      {activeTab === 'display' && <SchemaSection schema={displaySchema as Schema} />}
    </div>
  )
}
