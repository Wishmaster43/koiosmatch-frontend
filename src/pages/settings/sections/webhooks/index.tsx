/**
 * WebhooksSettings — the Webhooks section. A local sub-tab strip splits the two
 * directions: "Outgoing" (new event subscriptions KoiosMatch pushes out) and
 * "Incoming" (the existing token URLs that trigger workflows). Outgoing is the
 * default; incoming is preserved unchanged so workflows keep working.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SubTabBar from '@/components/drawer/SubTabBar'
import OutgoingWebhooks from './OutgoingWebhooks'
import IncomingWebhooks from './IncomingWebhooks'
import WhatsAppMetaWebhookCard from './WhatsAppMetaWebhookCard'

// Which direction sub-tab is active.
type WebhookDirectionTab = 'outgoing' | 'incoming'

// The Webhooks section: outgoing/incoming sub-tabs.
export default function WebhooksSettings() {
  const { t } = useTranslation('settings')
  const [tab, setTab] = useState<WebhookDirectionTab>('outgoing')

  const tabs = [
    { id: 'outgoing', label: t('webhooks.tab.outgoing') },
    { id: 'incoming', label: t('webhooks.tab.incoming') },
  ]

  return (
    <div>
      {/* Direction sub-tabs */}
      {/* Direction sub-tabs — the shared SubTabBar (DRY-1 O5); the wrapper keeps the old outer margin. */}
      <div style={{ marginBottom: 24 }}>
        <SubTabBar tabs={tabs} active={tab} onChange={(id) => setTab(id as WebhookDirectionTab)} />
      </div>

      {/* Danny 2026-08-31: the Meta address block belongs findable next to incoming webhooks. */}
      {tab === 'outgoing' ? <OutgoingWebhooks /> : (<><WhatsAppMetaWebhookCard /><IncomingWebhooks /></>)}
    </div>
  )
}
