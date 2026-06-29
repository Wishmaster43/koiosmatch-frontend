/**
 * MessageDrawer — slide-in detail panel for one message: recipient, timeline,
 * body and (when failed) the error. Pure presentation; the row is passed in from
 * MessagesTable. Badges/meta + formatter come from the shared messageParts.
 */
import { X, MessageCircle, Mail, User, Phone, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { MessageRow } from '@/types/reports'
import { formatDT, CHANNEL_META, ChannelBadge, StatusBadge } from './messageParts'

export default function MessageDrawer({ message, onClose }: { message: MessageRow; onClose: () => void }) {
  const { t } = useTranslation('reports')
  const channelKey = message.channel?.toLowerCase()
  const channelMeta = (channelKey ? CHANNEL_META[channelKey] : undefined) ?? { Icon: MessageCircle, color: 'var(--color-primary)' }
  const ChannelIcon = channelMeta.Icon

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={onClose} />

      <div className="fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-[var(--surface)]"
        style={{ width: 480, boxShadow: '-4px 0 30px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <ChannelIcon size={15} color={channelMeta.color} />
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                  {message.subject ?? message.template_name ?? t('messages.drawer.messageFallback', { id: message.id })}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <ChannelBadge channel={message.channel} />
                <StatusBadge status={message.status} />
              </div>
            </div>
            <button onClick={onClose}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                       borderRadius: 6, marginLeft: 10, flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* Recipient */}
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
                        letterSpacing: '0.05em', marginBottom: 8 }}>
            {t('messages.drawer.recipient')}
          </div>
          {[
            { icon: User,  label: t('messages.drawer.name'),   value: message.recipient_name },
            { icon: Phone, label: t('messages.drawer.mobile'), value: message.recipient_phone ?? message.to_phone },
            { icon: Mail,  label: t('messages.drawer.email'),  value: message.recipient_email ?? message.to_email },
          ].filter(r => r.value).map(r => (
            <div key={r.label} style={{ display: 'flex', gap: 8, padding: '7px 0',
                                        borderBottom: '1px solid var(--hover-bg)' }}>
              <r.icon size={13} color="var(--border)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 120, flexShrink: 0 }}>{r.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text)' }}>{r.value}</span>
            </div>
          ))}

          {/* Timeline */}
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
                        letterSpacing: '0.05em', marginTop: 20, marginBottom: 8 }}>
            {t('messages.drawer.timeline')}
          </div>
          {[
            { label: t('messages.drawer.sentAt'),      value: formatDT(message.sent_at     ?? message.created_at) },
            { label: t('messages.drawer.deliveredAt'), value: formatDT(message.delivered_at) },
            { label: t('messages.drawer.readAt'),      value: formatDT(message.read_at) },
            { label: t('messages.drawer.workflow'),    value: message.workflow_name },
            { label: t('messages.drawer.template'),    value: message.template_name },
          ].filter(r => r.value && r.value !== '—').map(r => (
            <div key={r.label} style={{ display: 'flex', gap: 8, padding: '7px 0',
                                        borderBottom: '1px solid var(--hover-bg)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{r.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text)' }}>{r.value}</span>
            </div>
          ))}

          {/* Message content */}
          {message.body && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
                            letterSpacing: '0.05em', marginBottom: 8 }}>
                {t('messages.drawer.body')}
              </div>
              <div style={{ background: 'var(--hover-bg)', borderRadius: 10, padding: '12px 14px',
                            fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {message.body}
              </div>
            </div>
          )}

          {/* Error message */}
          {message.error_message && (
            <div style={{ marginTop: 16, background: 'var(--color-danger-bg)', border: '1px solid #FCA5A5',
                          borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <AlertTriangle size={13} color="var(--color-danger)" />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-danger)' }}>{t('messages.drawer.error')}</span>
              </div>
              <pre style={{ fontSize: 11, color: 'var(--text)', whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all', margin: 0, fontFamily: 'monospace' }}>
                {message.error_message}
              </pre>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
