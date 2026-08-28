/**
 * koiosApi — axios calls for the Koios settings area (settings · usage · admin).
 *
 * Backend contract (baseURL already adds /api). KOIOS-MODEL-VOCAB-1 (27-08,
 * measured against KoiosAiSettingsController::settings()): no `pricing` field —
 * raw model rates are a platform/super-admin concern, never returned here.
 *   GET /ai/koios/settings → { models{active,selectable[],options[]{id,label,hint,cost_rank},cost_note},
 *                              currency, status{claude_configured, policy_loaded} }
 */
import api, { unwrap } from '@/lib/api'

// Tenant Koios settings: active/selectable models, pricing, connection status.
export const getKoiosSettings = () => api.get('/ai/koios/settings').then(unwrap)

// MODEL-KIEZER-1 (Danny 24-07 GO): switch the tenant's active model — the backend
// validates against the platform whitelist (Policy::selectableModels) + audits.
export const updateKoiosModel = (model) => api.put('/ai/koios/model', { model }).then(unwrap)

// C1-lane 2 (K-148, measured): the tenant-facing learning report — deterministic,
// no AI call. { period, top_questions[], failure_reasons{}, tools_requested_but_denied{},
// feedback{}, suggestions[] }.
export const getKoiosLearning = (from, to) => api.get('/ai/koios/learning', { params: { from, to } }).then(unwrap)

// KOIOS-CAPABILITIES-FE-1 (measured): the tenant tool matrix — surfaces/tools the
// assistant can act through, plus limits and the active model flavour. No AI call.
export const getKoiosCapabilities = () => api.get('/ai/koios/capabilities').then(unwrap)

// KOIOS-TOOL-MATRIX-FE-1: enable/disable/reset one tool for the tenant. A `null`
// value resets that tool to the platform default_enabled (never a client-side
// guess of what that default is). The backend rejects an unknown/forbidden tool
// name with 422 and returns fresh tools[] + default_enabled.
export const updateKoiosCapabilityTool = (name, value) =>
  api.patch('/ai/koios/capabilities/tools', { tools: { [name]: value } }).then(unwrap)

// KOIOS-FEEDBACK-FE-1 (measured against KoiosFeedbackController::index()): the
// admin feedback overview — paginated + filtered list plus a summary over the
// SAME filters. { summary{total,up,down,down_pct,reasons{}}, data[{id,
// prompt_log_id,surface,rating,reasons[],comment,user,prompt_excerpt,
// created_at,updated_at}], total, per_page, current_page, last_page }. No AI
// call (API-CREDITS-1) — pure reporting over already-stored rows.
export const getKoiosFeedback = (page = 1, perPage = 25) =>
  api.get('/ai/koios/feedback', { params: { page, per_page: perPage } }).then(unwrap)
