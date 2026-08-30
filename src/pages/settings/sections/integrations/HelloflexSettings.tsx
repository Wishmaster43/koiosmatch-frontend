/**
 * HelloflexSettings (INTEGRATIONS-SETTINGS-1) — the HelloFlex connector section:
 * Connection / Mapping / Contract map sub-tabs (Danny 31-08: "kopje integratie
 * en dan kopje ... met eigen subtabjes"). The contract-map screen moves in
 * unchanged (HF-CONTRACTMAP-1); connection + mapping speak the live
 * INTEGRATIONS-CONTRACT endpoints. Domains per contract §Mappings v1.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SubTabBar from '@/components/drawer/SubTabBar'
import IntegrationConnectionCard from './IntegrationConnectionCard'
import IntegrationMappingsTable from './IntegrationMappingsTable'
import HelloflexContractMapSettings from '../HelloflexContractMapSettings'

// Three sub-tabs; connection is the connector's front door.
export default function HelloflexSettings() {
  const { t } = useTranslation('settings')
  const [activeTab, setActiveTab] = useState('koppeling')

  const tabs = [
    { id: 'koppeling', label: t('integrations.tabs.connection') },
    { id: 'mapping', label: t('integrations.tabs.mapping') },
    { id: 'contractmap', label: t('integrations.tabs.contractmap') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SubTabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />
      {activeTab === 'koppeling' && <IntegrationConnectionCard connector="helloflex" />}
      {activeTab === 'mapping' && <IntegrationMappingsTable connector="helloflex" domains={['cao', 'schaal', 'trede', 'functie']} />}
      {activeTab === 'contractmap' && <HelloflexContractMapSettings />}
    </div>
  )
}
