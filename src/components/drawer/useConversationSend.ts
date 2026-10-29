/**
 * useConversationSend — the session composer's draft, the free-text send and the
 * queued-send refresh for ConversationsSection (ONIX-RECHECK #15).
 *
 * WHATSAPP-COMPOSE-1 / WA-SEND-TRANSPORT-1: the send goes through the backend-gated
 * POST /conversations/{id}/messages. 201 appends the server's own row; 409 (sender
 * declined) and 502 (gateway unreachable) render inline next to the still-there
 * draft. WA-THREAD-UX-1: a wa_web send answers 202 {outbox_id}, so a local stub
 * carrying `_pendingOutboxId` stands in until the refresh below pulls the real row.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
// DOUBLE-SUBMIT-FE-1 point 2: one Idempotency-Key per click on an irreversible action (BE IDEMP-1 replays).
import { withIdempotencyKey } from '@/lib/idempotency'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import type { Id } from '@/types/common'
import type { MessageRow } from './ConversationMessage'
import { mergeLandedMessages, type PendingMessage } from './conversationThreadMerge'
import { isWaWeb, type ConversationRow } from './conversationRows'

// WA-THREAD-UX-1 (verifier fix): bounded backoff for the queued-refresh poll below
// (GEO-POLL-1 idiom) — a wa_web send is drained on a minute cadence, so the first
// couple of reads stay at that pace, then back off; an honest cap (~11.5 min total)
// stops a stuck outbox row from polling forever. The focus listener stays unbounded
// since it only fires on a real user action.
export const QUEUED_REFRESH_DELAYS_MS = [60_000, 60_000, 120_000, 240_000, 300_000]

type MessagesState = Record<string, MessageRow[]>

// Draft text, in-flight latch and the send itself for the one open thread.
export function useConversationSend(
  openId: Id | null,
  setMessages: Dispatch<SetStateAction<MessagesState>>,
  refreshRows: () => void,
) {
  const { t } = useTranslation('candidates')
  // A single shared slot is enough since the accordion only ever has one open thread.
  const [composerText, setComposerText] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  // ONIX N-007: re-entrancy latch, written in the handler only (never during render).
  const sendingRef = useRef(false)
  // The 409/502 inline explanation — never a toast, so it survives next to the draft.
  const [sendError, setSendError] = useState<string | null>(null)

  // A newly opened thread starts with a clean draft — never leaks the previous
  // thread's unsent text (or its stale send error) into the one now expanded.
  useEffect(() => { setComposerText(''); setSendError(null) }, [openId])

  // POST the draft as an outbound session message and fold the answer into the thread.
  const sendMessage = useCallback((id: Id) => {
    const text = composerText.trim()
    if (!text) return
    // ONIX N-007: drop a re-entrant call while the previous send is still in flight.
    if (sendingRef.current) return
    sendingRef.current = true
    setSendingMsg(true)
    setSendError(null)
    api.post(`/conversations/${id}/messages`, { direction: 'outbound', message_content: text }, withIdempotencyKey())
      .then(r => {
        const res = r as { status?: number; data?: MessageRow & { outbox_id?: Id } }
        if (res.status === 202 && res.data?.outbox_id != null) {
          // Queued for the minute drainer: append a stub bubble marked pending so
          // the queued-refresh effect knows to keep polling this thread.
          const stub: PendingMessage = {
            id: `pending-${res.data.outbox_id}`, direction: 'outbound', message_content: text,
            // No sent_at: the server said "queued", so the bubble shows the queued marker,
            // never a timestamp plus a "Verzonden" tick it has not earned (verifier round 2).
            sent_at: null, _pendingOutboxId: res.data.outbox_id,
          }
          setMessages(m => ({ ...m, [String(id)]: [...(m[String(id)] ?? []), stub] }))
        } else if (res.data) {
          setMessages(m => ({ ...m, [String(id)]: [...(m[String(id)] ?? []), res.data as MessageRow] }))
        }
        setComposerText('')
        // Refresh this dossier's threads after a real send — last_message_at/is_active
        // now come from the server, never a locally guessed bump.
        refreshRows()
      })
      .catch(err => {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 409) {
          // Not sent: the sender itself declined — its own reason is the accurate explanation.
          setSendError(extractApiError(err, t('conversations.composerSendFailed')))
        } else if (status === 502) {
          // Meta/the gateway itself unreachable — an honest, translated retry notice.
          setSendError(t('conversations.composerUnavailable'))
        } else {
          notifyError(extractApiError(err, t('conversations.composerSendFailed')))
        }
      })
      .finally(() => { sendingRef.current = false; setSendingMsg(false) })
  }, [composerText, t, setMessages, refreshRows])

  return { composerText, setComposerText, sendingMsg, sendError, sendMessage }
}

// WA-THREAD-UX-1 (F3): a wa_web thread's last send can still be `queued` while the
// minute drainer works — refetch the open thread on a backing-off cadence (honest
// cap), and again when the tab regains focus. The refetch MERGES (mergeLandedMessages)
// so a read that resolves before the drain wrote its row never drops the just-sent bubble.
export function useQueuedMessageRefresh(
  openId: Id | null,
  rows: ConversationRow[],
  messages: MessagesState,
  setMessages: Dispatch<SetStateAction<MessagesState>>,
) {
  // How many backoff steps the CURRENT still-pending send set has used, keyed on that set.
  const attemptRef = useRef<{ key: string; count: number }>({ key: '', count: 0 })

  useEffect(() => {
    if (openId === null) return
    const openRow = rows.find(r => r.id === openId)
    if (!isWaWeb(openRow?.primary_channel)) return
    const openMsgs = messages[String(openId)] ?? []
    const pendingIds = openMsgs
      .map(m => (m as PendingMessage)._pendingOutboxId)
      .filter((id): id is Id => id != null)
      .sort()
    if (pendingIds.length === 0) return
    const key = `${openId}:${pendingIds.join(',')}`
    if (attemptRef.current.key !== key) attemptRef.current = { key, count: 0 }
    const refetch = () => {
      api.get(`/conversations/${openId}/messages`)
        .then(r => setMessages(m => ({
          ...m,
          [String(openId)]: mergeLandedMessages(unwrapList<MessageRow>(r).rows, m[String(openId)] ?? []),
        })))
        .catch(() => {})
    }
    window.addEventListener('focus', refetch)
    // Cap reached: keep the focus refetch (user-driven, cheap) but stop the timer.
    if (attemptRef.current.count >= QUEUED_REFRESH_DELAYS_MS.length) {
      return () => window.removeEventListener('focus', refetch)
    }
    const delay = QUEUED_REFRESH_DELAYS_MS[attemptRef.current.count]
    const timer = setTimeout(() => { attemptRef.current.count += 1; refetch() }, delay)
    return () => { clearTimeout(timer); window.removeEventListener('focus', refetch) }
  }, [openId, rows, messages, setMessages])
}
