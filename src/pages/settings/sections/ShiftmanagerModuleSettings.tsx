/**
 * Shiftmanager module settings — INTEGRATIONS-SETTINGS-1 (Danny 31-08: "under
 * the integrations heading, then a Shiftmanager heading with its own sub-tabs"): the section
 * fronts the CONNECTOR (Connection, Links) and the two REPORTING sub-tabs (KPI
 * targets, display limits, Danny 04-08). CONNECTOR-VS-REPORTING-1 (Danny 19-11): the
 * connector tabs show when the connector app is on OR the module is on (a legacy package),
 * the reporting tabs only with the `sm` module (the reporting add-on); neither = the calm
 * empty state. Supersedes the ONIX G-012 module-only gate.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BodyText } from '@/components/ui/typography'
import { useAuth } from '@/context/AuthContext'
import { useApps } from '@/context/AppsContext'
import ConnectorTabsShell from './integrations/ConnectorTabsShell'
import SchemaSection, { type Schema } from '../components/SchemaSection'
import displaySchema from '../schemas/display'
import smKpisSchema from '../schemas/smKpis'
import IntegrationConnectionCard from './integrations/IntegrationConnectionCard'
import IntegrationLinksPanel from './integrations/links/IntegrationLinksPanel'

// Connector front door first; the reporting tabs only with the module (add-on) on.
export default function ShiftmanagerModuleSettings() {
  const { t } = useTranslation('settings')
  const auth = useAuth()
  const apps = useApps()

  // Two signals, two scopes: the app is the connector switch, the module the reporting add-on;
  // the module alone still opens the connector (a legacy package carries sm without the app).
  const reportingOn = auth?.hasModule('sm') ?? false
  const connectorOn = reportingOn || (apps?.isAppEnabled('shiftmanager') ?? false)

  // Active sub-tab: the connection tab is the connector's front door.
  const [activeTab, setActiveTab] = useState('connection')

  // Deep-link guard: with neither signal there is nothing to show.
  if (!connectorOn) {
    return <BodyText style={{ color: 'var(--text-muted)' }}>{t('integrations.shiftmanagerConnectorOff')}</BodyText>
  }

  // No Mapping tab for Shiftmanager: a product decision (scout Q3); helloflex/werkzoeken keep theirs.
  // The two reporting tabs sit between Connection and Links, only while the add-on is on.
  const tabs = [
    { id: 'connection', label: t('integrations.tabs.connection') },
    ...(reportingOn ? [
      { id: 'kpis', label: t('smKpis.title') },
      { id: 'display', label: t('display.title') },
    ] : []),
    { id: 'links', label: t('integrations.tabs.links') },
  ]

  // A reporting tab selected before the add-on went off mid-session falls back to the front door.
  const shown = tabs.some(tab => tab.id === activeTab) ? activeTab : 'connection'

  // One sub-tab renders at a time, via the shared underline SubTabBar.
  return (
    <ConnectorTabsShell tabs={tabs} active={shown} onChange={setActiveTab}>
      {shown === 'connection' && <IntegrationConnectionCard connector="shiftmanager" />}
      {/* The .js schema literals are untyped and only structurally close to Schema — cast, don't retype the shared .js source (out of this task's scope). */}
      {shown === 'kpis' && <SchemaSection schema={smKpisSchema as Schema} />}
      {shown === 'display' && <SchemaSection schema={displaySchema as Schema} />}
      {shown === 'links' && <IntegrationLinksPanel system="shiftmanager" />}
    </ConnectorTabsShell>
  )
}
