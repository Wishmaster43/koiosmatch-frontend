/**
 * useMessageColumns — the ONE WhatsApp message column config, shared by the
 * WhatsAppPage "Messages" tab and the settings WhatsApp log (WhatsAppLog.tsx),
 * so date format, gateways and status/direction chips never drift between the
 * two surfaces (CLAUDE.md §3A "reuse, never duplicate").
 *
 * Two real gateways (CEL-DOORKLIK-CANON, Danny 25-08): the recipient name opens
 * the candidate drilldown, the conversation icon opens that candidate's
 * communication:conversations tab. Both no-op (plain text / no button) when the
 * row carries no linked candidate — never a dead link.
 */
import { useTranslation } from 'react-i18next'
import { MessageSquare } from 'lucide-react'
import type { Column } from '@/components/ui/DataTable'
import Button from '@/components/ui/Button'
import EntityLink from '@/components/ui/EntityLink'
import { Mono } from '@/components/ui/typography'
import { DirectionPill, StatusPill } from '@/components/ui/logChips'
import { useNavigation } from '@/context/NavigationContext'
import { useDateFormat } from '@/lib/datetime'
import type { WaMessage } from '@/types/whatsapp'

const fullName = (m: WaMessage) => [m.candidate?.first_name, m.candidate?.last_name].filter(Boolean).join(' ')

// Recipient cell: the candidate-drilldown gateway, via the shared EntityLink
// atom (never a hand-rolled button — CLAUDE.md §4 HUISSTIJL-1). A message
// without a linked candidate (not yet matched to a record) renders EntityLink's
// own plain-text fallback; the deep-link icon is hidden, this is a table cell,
// not a card header.
// eslint-disable-next-line react-refresh/only-export-components -- private cell component; the file's public export is the useMessageColumns hook (HMR-nicety warning only)
function RecipientCell({ message }: { message: WaMessage }) {
  const { t } = useTranslation('whatsapp')
  const name = fullName(message) || t('messages.unknownRecipient')
  return (
    <EntityLink page="candidates" id={message.candidate_id} hideIcon>
      {name}
    </EntityLink>
  )
}

// Conversation cell: opens the candidate's Communication → Conversations tab.
// Absent a linked candidate there is nothing to open — no button at all.
// eslint-disable-next-line react-refresh/only-export-components -- private cell component; the file's public export is the useMessageColumns hook (HMR-nicety warning only)
function ConversationCell({ message }: { message: WaMessage }) {
  const { t } = useTranslation('whatsapp')
  const { openEntity } = useNavigation()
  const candidateId = message.candidate_id
  if (candidateId == null) return null
  return (
    <Button variant="ghost" size="sm" iconOnly aria-label={t('messages.openConversation')}
      onClick={e => { e.stopPropagation(); openEntity('candidates', candidateId, 'communication:conversations') }}>
      <MessageSquare size={14} />
    </Button>
  )
}

// The shared column set — date (Mono, house DD-MM-YYYY HH:mm), recipient,
// direction, status, body and the conversation gateway. `clampBody` (WA-LOG-
// LEESBAAR-1, Danny 13-08) renders the body as two WRAPPED lines instead of one
// ellipsis line — the settings log passes it, restoring the readability fix
// this shared config replaced; the page's own Messages tab keeps the
// single-line ellipsis it already had.
export function useMessageColumns({ clampBody = false }: { clampBody?: boolean } = {}): Column<WaMessage>[] {
  const { t } = useTranslation('whatsapp')
  const { formatDateTime } = useDateFormat()
  return [
    { key: 'sent_at', header: t('messages.date'), width: 150, nowrap: true,
      render: m => <Mono>{formatDateTime(m.sent_at)}</Mono> },
    { key: 'recipient', header: t('messages.recipient'), width: 180,
      render: m => <RecipientCell message={m} /> },
    { key: 'direction', header: t('messages.direction'), width: 110,
      render: m => <DirectionPill direction={m.direction} /> },
    { key: 'status', header: t('messages.status'), width: 110,
      render: m => <StatusPill status={m.status} /> },
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
