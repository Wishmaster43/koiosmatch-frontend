/**
 * WhatsApp dashboard types. The page maps loosely-typed API payloads (stats,
 * messages, escalations, activity); these declare the fields the cards render.
 */

// A candidate as referenced by a message/escalation.
export interface WaCandidate { first_name?: string; last_name?: string; [k: string]: unknown }

// One WhatsApp message in the feed.
export interface WaMessage {
  id?: string | number
  // Top-level candidate reference (WhatsappDashboardController::messages) — the
  // table-cell gateways (recipient name, conversation icon) key off this: it is
  // set for native AND Shiftmanager-mirrored candidates, while the nested
  // `candidate` object only carries the native id.
  candidate_id?: string | number | null
  candidate?: WaCandidate
  direction?: string
  // 'smb_app_echo' = the business typed this in the WhatsApp app itself; the
  // webhook echoed it into the thread (K-160) — rendered with a 'via app' badge.
  purpose?: string
  status?: string
  body?: string
  sent_at?: string
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
  priority?: string | number
  queue?: string
  status?: string
  created_at?: string
  finished_at?: string | null
  [k: string]: unknown
}
