/**
 * WaConversationPanel — the READABLE conversation view behind a WhatsApp-log row
 * (WA-LOG-LEESBAAR-1, Danny 13-08: "de conversaties moeten groter, je wilt dit
 * niet verlezen"). Clicking a log row opens the WHOLE thread with that candidate
 * in a floating panel: chat bubbles (inbound left, outbound right), full text
 * that wraps — never the table's one-line ellipsis — and house-format timestamps.
 * Read-only by design: replying lives in the WhatsApp/candidate surfaces, the
 * log stays an audit view.
 */
import { useMemo } from 'react'
import { Caption, bodyTextStyle } from '@/components/ui/typography'
import { tintBg, tintBorder } from '@/lib/tint'
import { useTranslation } from 'react-i18next'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { StatusPill, isInbound } from '@/components/ui/logChips'
import { useDateFormat } from '@/lib/datetime'
import type { WaMessage } from '@/types/whatsapp'

interface WaConversationPanelProps {
  // The clicked row — anchors which candidate's thread this panel shows.
  message: WaMessage
  // The full loaded log; the panel filters it down to this candidate's thread.
  messages: WaMessage[]
  onClose: () => void
}

const nameOf = (m: WaMessage) => [m.candidate?.first_name, m.candidate?.last_name].filter(Boolean).join(' ')

export default function WaConversationPanel({ message, messages, onClose }: WaConversationPanelProps) {
  const { t } = useTranslation('settings')
  const { formatDateTime } = useDateFormat()

  // The thread: every message with the SAME candidate, oldest first (chat order).
  // A candidate-less row (system/test message) shows just itself.
  const thread = useMemo(() => {
    const cid = message.candidate?.id
    const mine = cid ? messages.filter(m => m.candidate?.id === cid) : [message]
    return [...mine].sort((a, b) => String(a.sent_at ?? '').localeCompare(String(b.sent_at ?? '')))
  }, [message, messages])

  const title = nameOf(message) || t('waLog.conversationUnknown')

  return (
    <FloatingPanel open onClose={onClose} title={title} ariaLabel={title}
      persistKey="wa-log-conversation" width={560} maxWidth="92vw" bodyStyle={{ padding: 16 }}>
      {/* Message count — honest scope: this is what the log currently holds. */}
      <Caption as="div" style={{ marginBottom: 12 }}>
        {t('waLog.conversationCount', { count: thread.length })}
      </Caption>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {thread.map((m, i) => {
          const inbound = isInbound(m.direction)
          return (
            <div key={m.id ?? i} style={{ display: 'flex', justifyContent: inbound ? 'flex-start' : 'flex-end' }}>
              {/* Bubble — inbound on the surface token, outbound on a primary tint;
                  13px + wrapping so long messages read comfortably (the point). */}
              <div style={{ ...bodyTextStyle, maxWidth: '82%', padding: '9px 12px', borderRadius: 12, lineHeight: 1.5,
                background: inbound ? 'var(--hover-bg)' : tintBg('var(--button-fill)'),
                border: `1px solid ${inbound ? 'var(--border)' : tintBorder('var(--button-fill)')}`,
                whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {m.body ?? '—'}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatDateTime(m.sent_at)}</span>
                  {m.status && <StatusPill status={m.status} />}
                  {/* K-160: the business typed this in the WhatsApp APP itself —
                      the webhook echoed it here (coexistence). */}
                  {m.purpose === 'smb_app_echo' && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('waLog.viaApp')}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </FloatingPanel>
  )
}
