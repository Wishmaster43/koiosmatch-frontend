/**
 * WebhooksSettings — the Webhooks section. A local sub-tab strip splits the two
 * directions: "Outgoing" (new event subscriptions KoiosMatch pushes out) and
 * "Incoming" (the existing token URLs that trigger workflows). Outgoing is the
 * default; incoming is preserved unchanged so workflows keep working.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import OutgoingWebhooks from './OutgoingWebhooks'
import IncomingWebhooks from './IncomingWebhooks'

export default function WebhooksSettings() {
  const { t } = useTranslation('settings')
  const [tab, setTab] = useState('outgoing')

  const tabs = [['outgoing', t('webhooks.tab.outgoing')], ['incoming', t('webhooks.tab.incoming')]]

  return (
    <div>
      {/* Direction sub-tabs */}
      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {tabs.map(([id, label]) => {
          const active = id === tab
          return (
            <button key={id} role="tab" aria-selected={active} onClick={() => setTab(id)}
              style={{ padding: '9px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 500, color: active ? 'var(--color-primary)' : 'var(--text-muted)', borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'transparent'}`, marginBottom: -1 }}>
              {label}
            </button>
          )
        })}
      </div>

      {tab === 'outgoing' ? <OutgoingWebhooks /> : <IncomingWebhooks />}
    </div>
  )
}
