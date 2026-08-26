/**
 * WaConversationPanel — the READABLE conversation view behind a WhatsApp-log row
 * (WA-LOG-LEESBAAR-1, Danny 13-08: "de conversaties moeten groter, je wilt dit
 * niet verlezen" — "the conversations must be bigger, you don't want to
 * misread this"). Clicking a log row opens the WHOLE thread in a floating
 * panel: chat bubbles (inbound left, outbound right), full text that wraps —
 * never the table's one-line ellipsis — and house-format timestamps. Read-only
 * by design: replying lives in the WhatsApp/candidate surfaces, the log stays
 * an audit view.
 *
 * WA-MSG-TABLE-2 (K-194): the panel now fetches the thread through its own
 * `conversation_id` (`GET /conversations/{id}/messages`, the same endpoint and
 * row shape ConversationsSection already uses) instead of filtering the ~50
 * already-loaded log rows client-side — a thread older than the loaded page,
 * or a contact-owned thread, used to render empty or wrong. It renders bubbles
 * through the shared `ConversationMessage` atom (extend, never duplicate).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { Caption } from '@/components/ui/typography'
import Spinner from '@/components/ui/Spinner'
import FloatingPanel from '@/components/ui/FloatingPanel'
import ConversationMessage, { type MessageRow } from '@/components/drawer/ConversationMessage'
import { useDateFormat } from '@/lib/datetime'
import type { WaMessage } from '@/types/whatsapp'

interface WaConversationPanelProps {
  // The clicked row — anchors which conversation this panel shows.
  message: WaMessage
  onClose: () => void
}

const nameOf = (m: WaMessage) => [m.candidate?.first_name, m.candidate?.last_name].filter(Boolean).join(' ')
  || [m.customer_contact?.first_name, m.customer_contact?.last_name].filter(Boolean).join(' ')

// Read-only conversation detail panel anchored on the clicked message row (see nameOf above for the candidate/contact name fallback).
export default function WaConversationPanel({ message, onClose }: WaConversationPanelProps) {
  const { t } = useTranslation('settings')
  // Per-namespace hooks (not an { ns } option) so the static key check resolves each key.
  const { t: tCandidates } = useTranslation('candidates')
  const { t: tCommon } = useTranslation('common')
  const { formatDateTime } = useDateFormat()
  const [thread, setThread] = useState<MessageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Load the thread by its own conversation_id; a row with no conversation_id
  // (a legacy/system message) shows just itself, unable to fetch a real thread.
  useEffect(() => {
    let alive = true
    setLoading(true); setError(false)
    if (message.conversation_id == null) {
      setThread([{ id: message.id ?? 0, direction: message.direction as 'inbound' | 'outbound' | undefined,
        message_content: message.body, sent_at: message.sent_at, purpose: message.purpose,
        channel: message.channel ?? undefined, channel_label: message.channel_label }])
      setLoading(false)
      return
    }
    // Without `before` the server only returns the default retention window; anchored on
    // now it pages backwards from the newest message. Rows arrive newest-first → reverse.
    api.get(`/conversations/${message.conversation_id}/messages`, { params: { before: new Date().toISOString(), per_page: 100 } })
      .then(r => { if (alive) setThread([...unwrapList<MessageRow>(r).rows].reverse()) })
      .catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // Depend on the identifying fields, not `message` object identity — a
    // caller re-creating the row per render must not re-trigger the fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.conversation_id, message.id])

  const title = nameOf(message) || t('waLog.conversationUnknown')

  return (
    <FloatingPanel open onClose={onClose} title={title} ariaLabel={title}
      persistKey="wa-log-conversation" width={560} maxWidth="92vw" bodyStyle={{ padding: 16 }}>
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
          <Spinner size={14} /> {tCandidates('conversations.loadingMessages')}
        </div>
      ) : error ? (
        <Caption as="div" style={{ padding: 24, textAlign: 'center' }}>{tCommon('error.body')}</Caption>
      ) : thread.length === 0 ? (
        <Caption as="div" style={{ padding: 24, textAlign: 'center' }}>{tCandidates('conversations.noMessages')}</Caption>
      ) : (
        <>
          {/* Message count — honest scope: this is what the thread currently holds. */}
          <Caption as="div" style={{ marginBottom: 12 }}>
            {t('waLog.conversationCount', { count: thread.length })}
          </Caption>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {thread.map((m, i) => <ConversationMessage key={m.id ?? i} message={m} formatDateTime={formatDateTime} />)}
          </div>
        </>
      )}
    </FloatingPanel>
  )
}
