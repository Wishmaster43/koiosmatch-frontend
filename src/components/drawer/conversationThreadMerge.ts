/**
 * conversationThreadMerge — the pure merge of a refetched thread with the queued (wa_web outbox)
 * stubs the user just sent; its own module so ConversationsSection exports components only
 * (react-refresh) and the rule is unit-testable on its own (WA-THREAD-UX-1).
 */
import type { MessageRow } from './ConversationMessage'
import type { Id } from '@/types/common'

export type PendingMessage = MessageRow & { _pendingOutboxId?: Id }

// WA-THREAD-UX-1 (verifier fix): a queued-refresh GET only ever carries what the
// `messages` table already has — the drainer writes that row separately from the
// outbox write (BE: Outbox::enqueue vs WhatsappWebChannel drain), so a refetch that
// lands before the drain still owns the truth for everything ELSE in the thread but
// knows nothing about a bubble the user just sent. Merge, never replace: keep any
// pending stub the server list does not yet contain, and drop a stub once a matching
// outbound row has landed (matched by direction + content — the read model carries no
// outbox_id to match on exactly).
export function mergeLandedMessages(serverRows: MessageRow[], prevRows: MessageRow[]): MessageRow[] {
  const stubs = prevRows.filter((m): m is PendingMessage => (m as PendingMessage)._pendingOutboxId != null)
  // Only a row the previous list did NOT hold can be the landed twin of a stub: an older
  // outbound bubble with the same text ("Top!", a repeated chase) must never claim it
  // (verifier round 2). The stub's own placeholder id is never a server id.
  const knownIds = new Set(prevRows.filter(m => (m as PendingMessage)._pendingOutboxId == null).map(m => String(m.id)))
  const unclaimedNewRows = serverRows.filter(r => !knownIds.has(String(r.id)))
  const stillPending = stubs.filter(stub => {
    const idx = unclaimedNewRows.findIndex(r => r.direction === 'outbound' && r.message_content === stub.message_content)
    if (idx === -1) return true
    unclaimedNewRows.splice(idx, 1)
    return false
  })
  return [...serverRows, ...stillPending]
}

