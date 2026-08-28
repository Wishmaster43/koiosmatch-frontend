/**
 * AIManagementView — the home of the AI-management family (agents · prompts ·
 * FAQ · knowledge · tools · interview flows). The tabs existed complete in
 * components/ai/AIManagementTabs but rendered NOWHERE (mega-audit r2, the
 * OrdersPanel class) — this view mounts them as the "Beheer" position on the
 * AI & Workflows page; the PLACEMENT itself is Danny-reviewable (WORKLIST).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import DrawerTabs from '@/components/drawer/DrawerTabs'
import { AgentsTab, PromptsTab, FAQTab, KnowledgeTab, ToolsTab, FlowsTab } from '@/components/ai/AIManagementTabs'

// Tab config per the shared DrawerTabs contract ({ id, label, render }).
export default function AIManagementView() {
  const { t } = useTranslation('workflows')
  const [active, setActive] = useState('agents')
  const tabs = [
    { id: 'agents',    label: t('ai.tabs.agents') },
    { id: 'prompts',   label: t('ai.tabs.prompts') },
    { id: 'faq',       label: t('ai.tabs.faq') },
    { id: 'knowledge', label: t('ai.tabs.knowledge') },
    { id: 'tools',     label: t('ai.tabs.tools') },
    { id: 'flows',     label: t('ai.tabs.flows') },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, flex: 1, overflow: 'auto' }}>
      <DrawerTabs tabs={tabs} active={active} onChange={setActive} />
      {active === 'agents' && <AgentsTab />}
      {active === 'prompts' && <PromptsTab />}
      {active === 'faq' && <FAQTab />}
      {active === 'knowledge' && <KnowledgeTab />}
      {active === 'tools' && <ToolsTab />}
      {active === 'flows' && <FlowsTab />}
    </div>
  )
}
