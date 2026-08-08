/**
 * ConversationMessage — one WhatsApp bubble inside a thread, extracted from
 * ConversationsSection (WA-WINDOW-1) so the section itself stays a container:
 * the bubble side/colour, the purpose badge and the delivery ticks are pure
 * presentation and have no business sitting next to the fetch logic (§3).
 *
 * Behaviour is unchanged — inbound left, outbound right, each outbound bubble
 * named + coloured by its sender through the shared avatar colour picker.
 */
import { useTranslation } from 'react-i18next'
import { Check, CheckCheck } from 'lucide-react'
import SoftChip from '@/components/ui/SoftChip'
import { avatarColor } from '@/lib/avatarColor'
import type { Id } from '@/types/common'

// The recruiter/agent behind an outbound message (e.g. Ravi, Kelly).
interface SentBy {
  id?: Id
  name?: string | null
}

// One message inside a thread — direction drives the bubble side, purpose the badge,
// sent_by/delivered_at/read_at drive the sender colour and delivery ticks (outbound only).
export interface MessageRow {
  id: Id
  direction?: 'inbound' | 'outbound'
  message_content?: string | null
  sent_at?: string | null
  purpose?: string | null
  sent_by?: SentBy | null
  delivered_at?: string | null
  read_at?: string | null
}

// Humanise a purpose slug for tenants whose value has no explicit translation.
const humanize = (s: string) => s.replace(/[_-]+/g, ' ').replace(/^\w/, c => c.toUpperCase())

// Stable colour per sender: the candidate (inbound) gets one fixed colour; each outbound
// recruiter/agent hashes to its own tint via the shared avatar colour picker — never a
// second hash function, so a name always reads the same colour app-wide.
const senderColor = (m: MessageRow) =>
  m.direction === 'outbound' ? avatarColor(m.sent_by?.name ?? undefined) : 'var(--color-success)'

// WhatsApp-style delivery indicator for outbound messages: sent → single grey check,
// delivered → double grey check, read → double check in the primary colour. The icon
// SHAPE is the real signal (single vs. double tick) with an aria-label — colour is never
// the only cue (§6).
export function DeliveryTicks({ sentAt, deliveredAt, readAt }: { sentAt?: string | null; deliveredAt?: string | null; readAt?: string | null }) {
  const { t } = useTranslation('candidates')
  if (!sentAt) return null
  const state: 'sent' | 'delivered' | 'read' = readAt ? 'read' : deliveredAt ? 'delivered' : 'sent'
  const Icon = state === 'sent' ? Check : CheckCheck
  const color = state === 'read' ? 'var(--color-primary)' : 'var(--text-muted)'
  return <Icon size={12} style={{ color, flexShrink: 0 }} role="img" aria-label={t(`conversations.delivery.${state}`)} />
}

export default function ConversationMessage({ message, formatDateTime }: {
  message: MessageRow
  // The host's locale-aware formatter — never a second date formatting rule (§5).
  formatDateTime: (value: string) => string
}) {
  const { t } = useTranslation('candidates')
  const out = message.direction === 'outbound'
  const color = senderColor(message)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: out ? 'flex-end' : 'flex-start' }}>
      {/* Outbound bubbles name the recruiter/agent behind them, colour-coded so Ravi vs Kelly reads at a glance. */}
      {out && message.sent_by?.name && (
        <span style={{ fontSize: 10, fontWeight: 600, color, marginBottom: 2 }}>{message.sent_by.name}</span>
      )}
      <div style={{ maxWidth: '85%', padding: '6px 10px', borderRadius: 10, fontSize: 12, color: 'var(--text)',
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 32%, transparent)` }}>
        {message.message_content ?? '—'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
        {message.purpose && (
          <SoftChip label={t(`conversations.purpose.${message.purpose}`, { defaultValue: humanize(message.purpose) })}
            color="var(--color-primary)" />
        )}
        {message.sent_at && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatDateTime(message.sent_at)}</span>}
        {out && <DeliveryTicks sentAt={message.sent_at} deliveredAt={message.delivered_at} readAt={message.read_at} />}
      </div>
    </div>
  )
}
