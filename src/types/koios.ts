/**
 * Koios AI assistant types. The /ai/koios/chat + /settings payloads are loosely
 * typed; these declare the fields the panel renders. `TFn` is a minimal translate
 * signature so the dumb subcomponents don't depend on the full i18next TFunction.
 */

// One tool step in an answer's trace.
export interface KoiosStep { tool?: string; status?: string; reason?: string; [k: string]: unknown }

// Token/cost usage for one answer.
export interface KoiosUsageData {
  input_tokens?: number
  output_tokens?: number
  cost?: number
  currency?: string
  calls?: number
  model?: string
  [k: string]: unknown
}

// One chat message (user bubble, welcome/error/forbidden notice, or a real reply).
export interface KoiosChatMessage {
  role: string
  content?: string
  kind?: string              // welcome | error | forbidden | knownError
  errorKey?: string          // i18n key (common:errors.*) when kind === 'knownError'
  answer?: string
  steps?: KoiosStep[]
  usage?: KoiosUsageData | null
  model?: string | null
  stopReason?: string
  // KOIOS-CHAT-SIGNALS-FE-1: which cap tripped a budget_exceeded stop —
  // 'monthly' | 'daily_user' | 'daily_tenant' (null for any other stop reason).
  budget?: { status?: string; reason?: string | null; [k: string]: unknown } | null
  // KOIOS-FEEDBACK-FE-1: the backend's prompt-log id for this answer, when it
  // logged one — KoiosFeedback (thumbs up/down) only renders when this is set,
  // since POST /ai/koios/feedback requires it.
  prompt_log_id?: string
  [k: string]: unknown
}

// GET /ai/koios/settings. KOIOS-MODEL-VOCAB-1 (27-08, measured against
// KoiosAiSettingsController::settings()): the controller never returns a
// `pricing` field any more (raw model rates are a platform/super-admin concern) —
// `options[]` (id/label/hint/cost_rank, AI-MODELS-1) is the tenant-facing
// vocabulary now, resolved server-side.
export interface KoiosSettings {
  models?: { active?: string; selectable?: string[]; options?: import('@/lib/koiosModelTiers').KoiosModelOption[]; cost_note?: string }
  currency?: string
  status?: { claude_configured?: boolean; policy_loaded?: boolean; api_ok?: boolean; api_error?: string | null; [k: string]: unknown }
  [k: string]: unknown
}

// One @-mention context reference attached to an outgoing chat turn (KOIOS-CTX-1,
// additive — the backend may ignore it until it lands). `label` is UI-only (the
// composer's removable chip); only `type`+`id` are ever sent to the API.
export interface KoiosContextRef {
  type: string
  id: string
  label: string
  // KOIOS-RESULT-CARDS-6-FE-1: optional caption line rendered under the label.
  subtitle?: string
  // KOIOS-RESULT-CARDS-6-FE-1: for a CHILD ref (appointment/note/document, which
  // have no page of their own) the owning parent record to route through instead.
  parent?: { type: string; id: string }
}

// Minimal translate signature for the Koios subcomponents.
export type TFn = (key: string, opts?: Record<string, unknown>) => string
