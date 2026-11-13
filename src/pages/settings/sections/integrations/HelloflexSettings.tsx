/**
 * HelloflexSettings (INTEGRATIONS-SETTINGS-1) — the HelloFlex connector section:
 * Connection / Mapping / Contract map / Links sub-tabs (Danny 31-08: "an integrations
 * heading and then a heading ... with its own sub-tabs"). The contract-map screen moves in
 * unchanged (HF-CONTRACTMAP-1); connection + mapping speak the live
 * INTEGRATIONS-CONTRACT endpoints. Domains per contract §Mappings v1.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ConnectorTabsShell from './ConnectorTabsShell'
import IntegrationConnectionCard from './IntegrationConnectionCard'
import IntegrationMappingsTable from './IntegrationMappingsTable'
import HelloflexContractMapSettings from '../HelloflexContractMapSettings'
import IntegrationLinksPanel from './links/IntegrationLinksPanel'

// Four sub-tabs; connection is the connector's front door.
export default function HelloflexSettings() {
  const { t } = useTranslation('settings')
  const [activeTab, setActiveTab] = useState('connection')

  const tabs = [
    { id: 'connection', label: t('integrations.tabs.connection') },
    { id: 'mapping', label: t('integrations.tabs.mapping') },
    { id: 'contractmap', label: t('integrations.tabs.contractmap') },
    { id: 'links', label: t('integrations.tabs.links') },
  ]

  return (
    <ConnectorTabsShell tabs={tabs} active={activeTab} onChange={setActiveTab}>
      {activeTab === 'connection' && <IntegrationConnectionCard connector="helloflex" />}
      {activeTab === 'mapping' && <IntegrationMappingsTable connector="helloflex" domains={['cao', 'schaal', 'trede', 'functie']} />}
      {activeTab === 'contractmap' && <HelloflexContractMapSettings />}
      {activeTab === 'links' && <IntegrationLinksPanel system="helloflex" />}
    </ConnectorTabsShell>
  )
}
