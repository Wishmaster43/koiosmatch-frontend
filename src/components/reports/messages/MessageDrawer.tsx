/**
 * MessageDrawer — slide-in detail panel for one message: recipient, timeline,
 * body and (when failed) the error. Pure presentation; the row is passed in from
 * MessagesTable. Badges/meta + formatter come from the shared messageParts.
 */
import { X, MessageCircle, Mail, User, Phone, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { PageTitle, GroupLabel, BodyText } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import type { MessageRow } from '@/types/reports'
import { formatDT, CHANNEL_META, ChannelBadge, StatusBadge } from './messageParts'

// One message full detail drawer, with a per-channel icon/colour falling back to a neutral chat icon for an unrecognised channel.
export default function MessageDrawer({ message, onClose }: { message: MessageRow; onClose: () => void }) {
  const { t } = useTranslation('reports')
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const channelKey = message.channel?.toLowerCase()
  const channelMeta = (channelKey ? CHANNEL_META[channelKey] : undefined) ?? { Icon: MessageCircle, color: 'var(--color-primary-text)' }
  const ChannelIcon = channelMeta.Icon

  return (
    <>
      <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.25)', zIndex: 'var(--z-drawer)' }} onClick={onClose} />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={t('messageDetail', { defaultValue: 'Message' })} tabIndex={-1}
        className="fixed top-0 bottom-0 right-0 flex flex-col bg-[var(--surface)]"
        style={{ width: 480, zIndex: 'var(--z-drawer)', boxShadow: 'var(--shadow-drawer)' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <ChannelIcon size={15} color={channelMeta.color} />
                {/* PageTitle's own 15px scale — weight overridden to 700 to keep the
                    pre-existing visual weight exactly (default is 600). */}
                <PageTitle as="span" style={{ fontWeight: 700 }}>
                  {message.subject ?? message.template_name ?? t('messages.drawer.messageFallback', { id: message.id })}
                </PageTitle>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <ChannelBadge channel={message.channel} />
                <StatusBadge status={message.status} />
              </div>
            </div>
            {/* Close icon button — the shared Button (§3), mirrors DrillDownDrawer/
                KpiDrillDownDrawer/ContactPersonDrawer's own close control. */}
            <Button variant="ghost" iconOnly onClick={onClose} aria-label={t('common:close')}
              style={{ marginLeft: 10, flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <X size={15} />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* Recipient */}
          <GroupLabel style={{ marginBottom: 8 }}>
            {t('messages.drawer.recipient')}
          </GroupLabel>
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
          <GroupLabel style={{ marginTop: 20, marginBottom: 8 }}>
            {t('messages.drawer.timeline')}
          </GroupLabel>
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
              <GroupLabel style={{ marginBottom: 8 }}>
                {t('messages.drawer.body')}
              </GroupLabel>
              <BodyText as="div" style={{ background: 'var(--hover-bg)', borderRadius: 10, padding: '12px 14px',
                            lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {message.body}
              </BodyText>
            </div>
          )}

          {/* Error message */}
          {message.error_message && (
            // eslint-disable-next-line no-restricted-syntax -- DATA: danger-border companion colour, mirrors the same literal used in RunDetailDrawer/EmailSettings/WhatsAppSettings
            <div style={{ marginTop: 16, background: 'var(--color-danger-bg)', border: '1px solid #FCA5A5',
                          borderRadius: 8, padding: '12px 14px' }}>
              {/* Ink is --color-on-danger-bg — the raw danger colour reads only 3.95:1
                  on its own pastel, AA fail (Opus r3.5). */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <AlertTriangle size={13} color="var(--color-on-danger-bg)" />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-on-danger-bg)' }}>{t('messages.drawer.error')}</span>
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
