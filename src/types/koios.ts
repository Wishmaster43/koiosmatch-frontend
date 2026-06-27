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
  kind?: string              // welcome | error | forbidden
  answer?: string
  steps?: KoiosStep[]
  usage?: KoiosUsageData | null
  model?: string | null
  stopReason?: string
  [k: string]: unknown
}

// GET /ai/koios/settings.
export interface KoiosSettings {
  models?: { active?: string; selectable?: string[] }
  pricing?: unknown
  currency?: string
  status?: { claude_configured?: boolean; [k: string]: unknown }
  [k: string]: unknown
}

// Minimal translate signature for the Koios subcomponents.
export type TFn = (key: string, opts?: Record<string, unknown>) => string
