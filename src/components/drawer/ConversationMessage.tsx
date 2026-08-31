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
import { tintBg, tintBorder } from '@/lib/tint'
import type { Id } from '@/types/common'
import { CHANNEL_COLORS, HANDLED_BY_COLORS } from './channelColors'

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
  // K-193: the message's own channel (enum) + server label, badge fallback source.
  channel?: string
  channel_label?: string | null
  // PUNT-2 (BE 0a8521df): who owned this turn — engine|workflow|human;
  // null/unknown = pre-flip row or future value, chip stays silent.
  handled_by?: string | null
}


// Humanise a purpose/priority slug for tenants whose value has no explicit
// translation — exported so every consumer of a raw server slug (this bubble,
// the messages table, the queue tab) shares one fallback, never a raw slug (§5).
// eslint-disable-next-line react-refresh/only-export-components -- shared pure helper, not a component; HMR-nicety warning only
export const humanize = (s: string) => s.replace(/[_-]+/g, ' ').replace(/^\w/, c => c.toUpperCase())

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

// Renders one WhatsApp bubble (see file docblock above): side/colour by direction
// and sender, purpose badge, delivery ticks for outbound messages.
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
      {/* Bubble fill is the sender's tint (§4, via lib/tint); the TEXT stays the
          neutral --text token on purpose — this is a message body, not a chip
          label, so it reads like ordinary prose regardless of sender colour. */}
      <div style={{ maxWidth: '85%', padding: '6px 10px', borderRadius: 10, fontSize: 12, color: 'var(--text)',
        background: tintBg(color),
        border: tintBorder(color) }}>
        {message.message_content ?? '—'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
        {message.channel && CHANNEL_COLORS[message.channel] && (
          <SoftChip label={t(`conversations.channel.${message.channel}`, { defaultValue: message.channel_label ?? '' })}
            color={CHANNEL_COLORS[message.channel]} />
        )}
        {message.purpose && (
          <SoftChip label={t(`conversations.purpose.${message.purpose}`, { defaultValue: humanize(message.purpose) })}
            color="var(--color-primary)" />
        )}
        {/* PUNT-2: the turn's owner — silent for null/unknown, mirrors the channel chip. */}
        {message.handled_by && HANDLED_BY_COLORS[message.handled_by] && (
          <SoftChip label={t(`conversations.handledBy.${message.handled_by}`)}
            color={HANDLED_BY_COLORS[message.handled_by]} />
        )}
        {message.sent_at && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatDateTime(message.sent_at)}</span>}
        {out && <DeliveryTicks sentAt={message.sent_at} deliveredAt={message.delivered_at} readAt={message.read_at} />}
      </div>
    </div>
  )
}
