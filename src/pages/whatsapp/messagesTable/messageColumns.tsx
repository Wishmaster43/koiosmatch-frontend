/**
 * useMessageColumns — the ONE WhatsApp message column config, shared by the
 * WhatsAppPage "Messages" tab and the settings WhatsApp log (WhatsAppLog.tsx),
 * so date format, gateways and status/direction chips never drift between the
 * two surfaces (CLAUDE.md §3A "reuse, never duplicate").
 *
 * WA-MSG-TABLE-2 (K-194, WHATSAPP-BERICHTEN-WIRE-1): the full column set —
 * sent_at · recipient · direction · channel · type · purpose · template ·
 * status · sentBy · body · conversation. Two real gateways (CEL-DOORKLIK-CANON,
 * Danny 25-08): the recipient name opens the owning candidate's or customer's
 * drilldown, the conversation icon opens that owner's conversations tab. Both
 * no-op (plain text / no button) when the row carries no linked owner at all —
 * never a dead link.
 */
import { useTranslation } from 'react-i18next'
import { MessageSquare } from 'lucide-react'
import type { Column } from '@/components/ui/DataTable'
import type { MouseEvent } from 'react'
import Button from '@/components/ui/Button'
import EntityLink from '@/components/ui/EntityLink'
import SoftChip from '@/components/ui/SoftChip'
import { Mono, Caption } from '@/components/ui/typography'
import { DirectionPill, StatusPill } from '@/components/ui/logChips'
import { CHANNEL_COLORS } from '@/components/drawer/channelColors'
import { humanize } from '@/components/drawer/ConversationMessage'
import { useNavigation } from '@/context/NavigationContext'
import { useDateFormat } from '@/lib/datetime'
import { interactive } from '@/lib/a11y'
import type { WaMessage } from '@/types/whatsapp'

// Optional filter gateway a chip cell calls when the caller wants type/template
// chips to double as table filters (stage B wires this to the panel state).
export interface MessageFilterPatch { type?: string; template?: string }

const candidateName = (m: WaMessage) => [m.candidate?.first_name, m.candidate?.last_name].filter(Boolean).join(' ')
const contactName = (m: WaMessage) => [m.customer_contact?.first_name, m.customer_contact?.last_name].filter(Boolean).join(' ')

// Recipient cell: candidate-owned rows link to the candidate drilldown; a
// contact-owned row links to the owning customer's Contacts tab instead (no
// EntityLink support for a tab target, so this cell drives openEntity itself,
// styled with the same accent-text Button variant). wa_number_masked renders
// underneath as a Caption regardless of which owner (or none) resolved.
// eslint-disable-next-line react-refresh/only-export-components -- private cell component; the file's public export is the useMessageColumns hook (HMR-nicety warning only)
function RecipientCell({ message }: { message: WaMessage }) {
  const { t } = useTranslation('whatsapp')
  const { openEntity } = useNavigation()
  const nameNode = message.candidate_id != null ? (
    <EntityLink page="candidates" id={message.candidate_id} hideIcon>
      {candidateName(message) || t('messages.unknownRecipient')}
    </EntityLink>
  ) : message.customer_contact ? (
    <Button variant="ghostAccent" size="sm" style={{ padding: 0, height: 'auto', justifyContent: 'flex-start' }}
      onClick={e => { e.stopPropagation(); openEntity('customers', message.customer_contact!.customer_id, 'contacts') }}>
      {contactName(message) || t('messages.unknownRecipient')}
    </Button>
  ) : (
    <span>{t('messages.unknownRecipient')}</span>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      {nameNode}
      {/* K-197: the full number arrives only behind candidates.view; otherwise the masked form. */}
      {(message.wa_number ?? message.wa_number_masked) && <Caption>{message.wa_number ?? message.wa_number_masked}</Caption>}
    </div>
  )
}

// Channel cell: the enum's own token colour + translated label; no chip at all
// for an unknown/legacy channel with no server label (never a raw code).
// eslint-disable-next-line react-refresh/only-export-components -- private cell component; the file's public export is the useMessageColumns hook (HMR-nicety warning only)
function ChannelCell({ message }: { message: WaMessage }) {
  const { t } = useTranslation('candidates')
  const channel = message.channel
  const known = channel != null && channel in CHANNEL_COLORS
  if (!known && !message.channel_label) return null
  const label = known ? t(`conversations.channel.${channel}`, { defaultValue: message.channel_label ?? '' }) : message.channel_label
  if (!label) return null
  return <SoftChip label={label} color={known ? CHANNEL_COLORS[channel as string] : null} />
}

// Type cell: the tenant message-type chip + an optional priority marker. Both
// chips call `onFilter` when the caller wired one in (stage B); without it they
// stay plain SoftChips — inert, no role/cursor/tabIndex (§ rule 5).
// eslint-disable-next-line react-refresh/only-export-components -- private cell component; the file's public export is the useMessageColumns hook (HMR-nicety warning only)
function TypeCell({ message, onFilter }: { message: WaMessage; onFilter?: (patch: MessageFilterPatch) => void }) {
  const { t } = useTranslation('whatsapp')
  const type = message.message_type
  if (!type) return null
  // Optional param so `interactive()`'s keyboard path (which calls onClick with
  // no event) still works, while a real mouse click stops it reaching the row.
  const onClick = onFilter ? (e?: MouseEvent) => { e?.stopPropagation(); onFilter({ type: String(type.id) }) } : undefined
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span {...interactive(onClick)} style={onClick ? { cursor: 'pointer', display: 'inline-flex' } : { display: 'inline-flex' }}>
        <SoftChip label={type.label} color={type.color} />
      </span>
      {type.is_priority && <SoftChip label={t('messages.priority')} color="var(--color-warning)" />}
    </span>
  )
}

// Template cell: the real template name (Mono), or the house dash. Clickable
// gateway into the table's own filter when `onFilter` is wired; otherwise inert.
// eslint-disable-next-line react-refresh/only-export-components -- private cell component; the file's public export is the useMessageColumns hook (HMR-nicety warning only)
function TemplateCell({ message, onFilter }: { message: WaMessage; onFilter?: (patch: MessageFilterPatch) => void }) {
  if (!message.template_name) return <Mono>—</Mono>
  // Same optional-event guard as TypeCell — see comment there.
  const onClick = onFilter ? (e?: MouseEvent) => { e?.stopPropagation(); onFilter({ template: message.template_name! }) } : undefined
  return (
    <span {...interactive(onClick)} style={onClick ? { cursor: 'pointer' } : undefined}>
      <Mono>{message.template_name}</Mono>
    </span>
  )
}

// Status cell: translated label (never the raw server value), with a tooltip
// listing the delivery timestamps + failure reason when present.
// eslint-disable-next-line react-refresh/only-export-components -- private cell component; the file's public export is the useMessageColumns hook (HMR-nicety warning only)
function StatusCell({ message }: { message: WaMessage }) {
  const { t } = useTranslation('whatsapp')
  const { formatDateTime } = useDateFormat()
  if (!message.status) return <StatusPill status={message.status} />
  const parts: string[] = []
  if (message.delivered_at) parts.push(`${t('msgStatus.delivered')}: ${formatDateTime(message.delivered_at)}`)
  if (message.read_at) parts.push(`${t('msgStatus.read')}: ${formatDateTime(message.read_at)}`)
  if (message.failed_at) parts.push(`${t('msgStatus.failed')}: ${formatDateTime(message.failed_at)}`)
  if (message.failure_reason) parts.push(message.failure_reason)
  return <StatusPill status={message.status} label={t(`msgStatus.${message.status}`, { defaultValue: humanize(message.status) })} title={parts.join(' · ') || undefined} />
}

// Conversation cell: opens the row's owner's Communication → Conversations tab
// (candidate) or Communication tab (customer contact). Absent an owner there is
// nothing to open — no button at all.
// eslint-disable-next-line react-refresh/only-export-components -- private cell component; the file's public export is the useMessageColumns hook (HMR-nicety warning only)
function ConversationCell({ message }: { message: WaMessage }) {
  const { t } = useTranslation('whatsapp')
  const { openEntity } = useNavigation()
  if (message.candidate_id != null) {
    return (
      <Button variant="ghost" size="sm" iconOnly aria-label={t('messages.openConversation')}
        onClick={e => { e.stopPropagation(); openEntity('candidates', message.candidate_id, 'communication:conversations') }}>
        <MessageSquare size={14} />
      </Button>
    )
  }
  if (message.customer_contact) {
    return (
      <Button variant="ghost" size="sm" iconOnly aria-label={t('messages.openConversation')}
        onClick={e => { e.stopPropagation(); openEntity('customers', message.customer_contact!.customer_id, 'communication') }}>
        <MessageSquare size={14} />
      </Button>
    )
  }
  return null
}

// The shared column set. `clampBody` (WA-LOG-LEESBAAR-1, Danny 13-08) renders
// the body as two WRAPPED lines instead of one ellipsis line — the settings log
// passes it; the page's own Messages tab keeps the single-line ellipsis it
// already had. `onFilter` (stage B) wires the type/template chips into the
// table's own filter state; omitted, those chips stay inert.
export function useMessageColumns({ clampBody = false, onFilter }: { clampBody?: boolean; onFilter?: (patch: MessageFilterPatch) => void } = {}): Column<WaMessage>[] {
  const { t } = useTranslation('whatsapp')
  const { formatDateTime } = useDateFormat()
  return [
    { key: 'sent_at', header: t('messages.date'), width: 150, nowrap: true,
      render: m => <Mono>{formatDateTime(m.sent_at)}</Mono> },
    { key: 'recipient', header: t('messages.recipient'), width: 190,
      render: m => <RecipientCell message={m} /> },
    { key: 'direction', header: t('messages.direction'), width: 110,
      render: m => <DirectionPill direction={m.direction} /> },
    { key: 'channel', header: t('messages.channel'), width: 110,
      render: m => <ChannelCell message={m} /> },
    { key: 'type', header: t('messages.type'), width: 150,
      render: m => <TypeCell message={m} onFilter={onFilter} /> },
    { key: 'purpose', header: t('messages.purpose'), width: 150,
      render: m => m.purpose
        ? <span>{t(`candidates:conversations.purpose.${m.purpose}`, { defaultValue: humanize(m.purpose) })}</span>
        : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    { key: 'template', header: t('messages.template'), width: 150,
      render: m => <TemplateCell message={m} onFilter={onFilter} /> },
    { key: 'status', header: t('messages.status'), width: 120,
      render: m => <StatusCell message={m} /> },
    { key: 'sentBy', header: t('messages.sentBy'), width: 130,
      render: m => <span>{m.sent_by_user?.name ?? t('messages.automatic')}</span> },
    { key: 'body', header: t('messages.body'), render: m => (
      clampBody ? (
        <span title={m.body ?? ''} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', maxWidth: 460, lineHeight: 1.4 }}>{m.body ?? '—'}</span>
      ) : (
        <span title={m.body ?? ''} style={{ display: 'block', maxWidth: 460, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.body ?? '—'}</span>
      )
    ) },
    { key: 'conversation', header: '', width: 44, align: 'center',
      render: m => <ConversationCell message={m} /> },
  ]
}
