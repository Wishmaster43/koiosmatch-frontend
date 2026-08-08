/**
 * conversationAssistApi — thin API layer for the Koios AI conversation assist
 * (G27 / K2-CONV-ASSIST-1): summarize a WhatsApp thread or extract action items
 * from it. SUGGESTIONS ONLY — mirrors noteAssistApi.ts's response shape (same
 * discriminated union), but the request carries NO text: the backend reads the
 * thread's own stored messages from `id` (KoiosConversationAssistController::
 * transcript, PII-stripped server-side — phone numbers/wamids never leave).
 * Hand-written types (§10): this freshly landed route has no openapi-typescript
 * entry yet. A cross-import of tabs/notes/noteAssistApi.ts was deliberately
 * avoided — that folder is out of this job's owned scope, so the shape is
 * mirrored here rather than shared/forked.
 */
import api from '@/lib/api'
import type { Id } from '@/types/common'

export type ConversationAssistMode = 'summarize' | 'actions'
// The action-item types the backend can extract from a conversation
// (ConversationAssistPrompt::ACTION_TYPES) — narrower than notes (no "email":
// a WhatsApp thread follows up over WhatsApp); anything else is dropped server-side.
export type ConversationAssistActionType = 'task' | 'whatsapp' | 'appointment' | 'notification'
export interface ConversationAssistActionItem {
  title: string
  type: ConversationAssistActionType
  due_date: string | null
  note_excerpt: string | null
}
// Dutch fallback label per action-item type (mirrors noteAssistApi's
// ACTION_TYPE_LABEL_NL, minus "email" — the conversation vocabulary has no
// email item). DEFAULT-VALUE-1 pattern: this lane never edits locale JSON, so
// every t() call carries this as its defaultValue until the reported
// `candidates:conversations.assist.actionTypes.*` keys land.
export const ACTION_TYPE_LABEL_NL: Record<ConversationAssistActionType, string> = {
  task: 'Taak', whatsapp: 'WhatsApp', appointment: 'Afspraak', notification: 'Melding',
}
// summarize returns prose; actions returns structured items — one discriminated
// result so the caller never has to guess the shape by mode alone.
export type ConversationAssistResult =
  | { kind: 'text'; text: string }
  | { kind: 'actions'; items: ConversationAssistActionItem[] }

interface ApiTextResponse { text: string }
interface ApiActionsResponse { items: ConversationAssistActionItem[] }

/**
 * POST /ai/koios/conversations/{id}/assist — one assist call over the thread's
 * OWN stored messages (never a client-sent transcript, §9 data minimization).
 * 402 = the tenant's Koios budget is exhausted this month; 422 = actions mode
 * could not parse a usable list, or the thread has no messages yet; 503 = no
 * Claude key configured — all three are expected, caller-handled outcomes (see
 * useConversationAssist), so quietStatuses keeps the dev console/toast quiet
 * for them (mirrors noteAssistApi.ts). A longer timeout than the 20s default:
 * a real Anthropic round-trip, not a CRUD call.
 */
export async function assistConversation(
  { id, mode, language }: { id: Id; mode: ConversationAssistMode; language?: string },
  signal?: AbortSignal,
): Promise<ConversationAssistResult> {
  const res = await api.post<ApiTextResponse | ApiActionsResponse>(`/ai/koios/conversations/${id}/assist`,
    { mode, language },
    { signal, timeout: 60000, quietStatuses: [402, 422, 503] })
  return mode === 'actions'
    ? { kind: 'actions', items: (res.data as ApiActionsResponse).items ?? [] }
    : { kind: 'text', text: (res.data as ApiTextResponse).text ?? '' }
}
