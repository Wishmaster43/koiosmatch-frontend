/**
 * WhatsApp dashboard types. The page maps loosely-typed API payloads (stats,
 * messages, escalations, activity); these declare the fields the cards render.
 */

// A candidate as referenced by a message/escalation.
export interface WaCandidate { first_name?: string; last_name?: string; [k: string]: unknown }

// One WhatsApp message in the feed.
export interface WaMessage {
  id?: string | number
  candidate?: WaCandidate
  direction?: string
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
