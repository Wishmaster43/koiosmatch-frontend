/**
 * MessagingSettings — the Messaging section. A local sub-tab strip splits the
 * three areas: Limits (editable cap ≤ ceiling), Costs (read-only breakdown) and
 * Retention (tenant + own, effective = lowest). Each tab owns its own data load.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import MessagingLimits from './MessagingLimits'
import QueueSettings from './QueueSettings'
import MessagingCosts from './MessagingCosts'
import MessageRetention from './MessageRetention'

export default function MessagingSettings() {
  const { t } = useTranslation('settings')
  const [tab, setTab] = useState('limits')

  const tabs = [
    ['limits', t('messaging.tab.limits')],
    ['queue', t('messaging.tab.queue')],
    ['costs', t('messaging.tab.costs')],
    ['retention', t('messaging.tab.retention')],
  ]

  return (
    <div>
      {/* Section title comes from the nav label ("WhatsApp Privé") — no redundant heading here. */}
      {/* Sub-tabs */}
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

      {tab === 'limits' ? <MessagingLimits /> : tab === 'queue' ? <QueueSettings /> : tab === 'costs' ? <MessagingCosts /> : <MessageRetention />}
    </div>
  )
}
