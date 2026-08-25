/**
 * WhatsApp dashboard types. The page maps loosely-typed API payloads (stats,
 * messages, escalations, activity); these declare the fields the cards render.
 */

// A candidate as referenced by a message/escalation.
export interface WaCandidate { first_name?: string; last_name?: string; [k: string]: unknown }

// A customer contact as referenced by a message (CONTACT-CONVERSATION-START) —
// the thread's other possible owner besides a candidate, mutually exclusive.
export interface WaCustomerContact {
  id: string | number
  first_name?: string | null
  last_name?: string | null
  customer_id: string | number
  [k: string]: unknown
}

// One tenant WhatsApp message TYPE (whatsapp_message_types), as embedded on a
// message row — resolved server-side once per page, never re-derived client-side.
export interface WaMessageType {
  id: string | number
  value?: string
  label: string
  color?: string | null
  sort_order?: number
  is_priority?: boolean
}

// The user who sent a message (null on the row itself = automatic/system send).
export interface WaSentByUser { id: string | number; name?: string | null }

// One WhatsApp message in the feed (WHATSAPP-BERICHTEN-WIRE-1, K-194 — full wire
// shape of WhatsappDashboardController::messages()).
export interface WaMessage {
  id?: string | number
  conversation_id?: string | number | null
  // Top-level candidate reference (WhatsappDashboardController::messages) — the
  // table-cell gateways (recipient name, conversation icon) key off this: it is
  // set for native AND Shiftmanager-mirrored candidates, while the nested
  // `candidate` object only carries the native id.
  candidate_id?: string | number | null
  candidate?: WaCandidate
  // The thread's OTHER possible owner (mutually exclusive with candidate_id/candidate).
  customer_contact?: WaCustomerContact | null
  direction?: string
  body?: string
  // sent | delivered | read | failed | received (App\Messaging\MessageStatus).
  status?: string
  sent_at?: string
  delivered_at?: string | null
  read_at?: string | null
  failed_at?: string | null
  failure_reason?: string | null
  // 'smb_app_echo' = the business typed this in the WhatsApp app itself; the
  // webhook echoed it into the thread (K-160) — rendered with a 'via app' badge.
  purpose?: string | null
  message_type?: WaMessageType | null
  template_name?: string | null
  // null = automatic/system send (workflow, AI) rather than a human user.
  sent_by_user?: WaSentByUser | null
  // Meta phone_number_id of the SENDING number.
  whatsapp_number_id?: string | null
  channel?: 'waba' | 'waba_coex' | 'wa_web' | string | null
  channel_label?: string | null
  // §8: the real number never reaches the wire, only this masked form.
  wa_number_masked?: string | null
  [k: string]: unknown
}

// One conversation flagged for human follow-up.
export interface WaEscalation {
  candidate_id?: string | number
  candidate?: WaCandidate
  reason?: string
  hours_waiting?: number
  [k: string]: unknown
}

// One point on the inbound/outbound activity chart.
export interface WaActivityDatum { date: string; inbound?: number; outbound?: number; [k: string]: unknown }

// One WhatsApp Business connection/token (WA-VESTIGING-FE-1, GET/POST/PATCH /whatsapp).
// A tenant now holds MULTIPLE rows, each scoped to everyone (both null), one branch
// (location_id) or one role (role_name) — exclusive, server-enforced (422 on both).
// Secrets (access_token/app_secret/webhook_verify_token) are $hidden on the backend
// model and never present here; has_verify_token is the derived boolean it appends
// instead, so the UI can show "a token is set" without ever seeing the value.
export interface WhatsappConnectionRow {
  id: string
  waba_id: string
  label?: string | null
  location_id?: string | null
  role_name?: string | null
  is_default: boolean
  has_verify_token: boolean
  // 'embedded' = linked through the coexistence wizard (K-160) — its token
  // lives server-side only and disconnecting happens in the WhatsApp app.
  provider?: 'meta' | '360dialog' | 'embedded'
  status?: 'active' | 'inactive' | 'expired'
  // Set when PARTNER_REMOVED disconnected a coexistence link (K-160).
  down_since?: string | null
  last_checked_at?: string | null
  [k: string]: unknown
}

// The KPI stats block.
export interface WaStats {
  messages_today?: number
  candidates_contacted?: number
  shifts_filled_via_whatsapp?: number
  open_escalations?: number
  [k: string]: unknown
}

// One WABA batch row in the "Wachtrij" tab — today's batches (GET /whatsapp-queue, R3a).
// `status` is a free-text backend value; a batch is "active" while it has no
// finished_at (see isBatchActive in useWhatsAppQueue).
export interface WaQueueBatch {
  batch_id: string
  workflow_name?: string
  total: number
  queued?: number
  sent?: number
  skipped?: number
  failed?: number
  phone_number_id?: string
  tempo?: string | number
  message_type_label?: string
  // K-194 (e): a slug (high|normal|low), never a Dutch label — translate in the FE.
  priority?: 'high' | 'normal' | 'low' | string
  queue?: string
  status?: string
  created_at?: string
  finished_at?: string | null
  [k: string]: unknown
}
