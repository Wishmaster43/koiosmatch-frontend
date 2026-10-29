/**
 * conversationRows — the thread-list row shapes and pure row helpers shared by
 * ConversationsSection and its hooks (split out of the component, ONIX-RECHECK #15).
 */
import type { Id } from '@/types/common'
import type { ConversationSubject } from './useWhatsAppTemplateSend'

// The candidate identity carried on a conversation row — drives the thread heading (name over number).
export interface ConversationCandidate {
  id?: Id
  first_name?: string | null
  last_name?: string | null
}

// CONTACT-CONVERSATION-START: the ConversationResource-normalized owner block
// (ConversationResource::ownerShape, koiosmatch-api) — one shape whichever of the
// two nullable owner columns is actually populated, so a caller never has to guess.
export interface ConversationOwner {
  type: 'candidate' | 'customer_contact'
  id: Id
  name?: string | null
}

// One conversation thread as the list endpoint returns it (only the fields the panel shows).
export interface ConversationRow {
  id: Id
  // WA-WINDOW-1: the thread's own candidate — what POST /conversations/start needs
  // to send a template once the window has closed (measured on GET /conversations).
  candidate_id?: Id | null
  // GESPREK-CONTACT-1: the other possible owner (mutually exclusive with candidate_id).
  customer_contact_id?: Id | null
  // CONTACT-CONVERSATION-START: the normalized owner, when the API returns it.
  owner?: ConversationOwner | null
  wa_number?: string | null
  last_message_at?: string | null
  // WHATSAPP-COMPOSE-1: the 24h session anchor (ConversationResource / Conversation
  // migration comment) — the ONLY signal that gates the free-text composer below.
  last_inbound_at?: string | null
  is_active?: boolean
  escalated?: boolean
  candidate?: ConversationCandidate | null
  // K-193: the thread's dominant channel (enum) + server label, badge fallback source.
  primary_channel?: 'waba' | 'waba_coex' | 'wa_web' | string
  channel_label?: string | null
  // PUNT-2: "last turn" semantics — owner of the last message (including the inbound stamp).
  last_handled_by?: string | null
  // GESPREK-CONSISTENT-1-FE (KLEIN-BE-2, hand-written — the spec carries no 2xx
  // schema for GET /conversations yet): the application this thread was started
  // from, or was stamped with by an in-window interview send. Nullable context.
  application_id?: Id | null
}

// Prefer the candidate's real name over the raw WhatsApp number for the thread heading.
export const candidateFullName = (row: ConversationRow) =>
  [row.candidate?.first_name, row.candidate?.last_name].filter(Boolean).join(' ').trim()

// CONTACT-CONVERSATION-START: this thread's owner as {kind,id} for the template
// composer — prefers the normalized `owner` block, falls back to the older
// candidate_id/nested-candidate/customer_contact_id fields for a partial API shape.
// Null only when neither owner is known at all (a genuine dead end).
export const rowSubject = (row: ConversationRow): ConversationSubject | null => {
  if (row.owner) return { kind: row.owner.type, id: row.owner.id }
  const candidateId = row.candidate_id ?? row.candidate?.id
  if (candidateId) return { kind: 'candidate', id: candidateId }
  if (row.customer_contact_id) return { kind: 'customer_contact', id: row.customer_contact_id }
  return null
}


// A wa_web thread has no 24h session gate — the server queues and drains at any time.
export const isWaWeb = (channel?: string) => channel === 'wa_web'
