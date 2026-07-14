/**
 * koiosApi — axios calls for the Koios AI assistant (baseURL already adds /api).
 *
 * Backend contract:
 *   POST /api/ai/koios/chat      { message, model?, context?, history? }
 *     → { answer, steps[], model, stop_reason, usage{input_tokens,output_tokens,calls,cost,currency},
 *         pending_action? }                                            — KOIOS-AGENT-PLAN §6, dormant
 *   GET  /api/ai/koios/settings  → { models{active,selectable[]}, pricing, currency, status{...} }
 *   POST /api/ai/koios/actions/{id}/confirm | /cancel                  — KOIOS-AGENT-PLAN §6, dormant
 *
 * /chat is synchronous (no streaming) and can take a few seconds — the caller
 * shows a loading state. `context` (KOIOS-CTX-1) only ever sends types the
 * backend can actually resolve today (koiosContextTypes.ts) — every other
 * @-mentioned category stays a client-side-only chip so an unresolvable type
 * never trips the server's strict 422; the mentioned name is also in the
 * message text, so the reply degrades gracefully either way.
 */
import api from '@/lib/api'
import type { KoiosContextRef } from '@/types/koios'
import { isContextResolvable } from './koiosContextTypes'

// Send one chat turn. `model` is optional (defaults to the tenant's active
// model); `context` is the @-mentioned records, filtered to backend-resolvable
// types — only { type, id } are sent, never the display label.
export const sendChat = (message: string, model?: string | null, context?: KoiosContextRef[]) => {
  const body: Record<string, unknown> = { message }
  if (model) body.model = model
  const resolvable = context?.filter((ref) => isContextResolvable(ref.type)) ?? []
  if (resolvable.length) body.context = resolvable.map(({ type, id }) => ({ type, id }))
  return api.post('/ai/koios/chat', body).then((r) => r.data)
}

// Load the Koios settings (selectable models + connection/policy status).
export const getKoiosSettings = () => api.get('/ai/koios/settings').then((r) => r.data)

// Confirm a pending action (KOIOS-AGENT-PLAN §6) — turns a proposed write into
// an executed one. Dormant until the backend ships `pending_action`; the caller
// (KoiosPendingActionCard) treats 404/410/422 as "expired/already resolved".
export const confirmPendingAction = (id: string) =>
  api.post(`/ai/koios/actions/${id}/confirm`).then((r) => r.data)

// Cancel a pending action — same dormant/expiry handling as confirm.
export const cancelPendingAction = (id: string) =>
  api.post(`/ai/koios/actions/${id}/cancel`).then((r) => r.data)
