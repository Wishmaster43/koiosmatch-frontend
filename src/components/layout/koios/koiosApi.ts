/**
 * koiosApi — axios calls for the Koios AI assistant (baseURL already adds /api).
 *
 * Backend contract:
 *   POST /api/ai/koios/chat      { message, model?, context? }
 *     → { answer, steps[], model, stop_reason, usage{input_tokens,output_tokens,calls,cost,currency} }
 *   GET  /api/ai/koios/settings  → { models{active,selectable[]}, pricing, currency, status{...} }
 *
 * /chat is synchronous (no streaming) and can take a few seconds — the caller
 * shows a loading state. `context` (KOIOS-CTX-1, additive) is being filed with
 * backend-Claude — the server may ignore it until it lands; the @-mentioned
 * name is also in the message text, so the reply degrades gracefully either way.
 */
import api from '@/lib/api'
import type { KoiosContextRef } from '@/types/koios'

// Send one chat turn. `model` is optional (defaults to the tenant's active
// model); `context` is the @-mentioned records — only { type, id } are sent,
// never the display label.
export const sendChat = (message: string, model?: string | null, context?: KoiosContextRef[]) => {
  const body: Record<string, unknown> = { message }
  if (model) body.model = model
  if (context?.length) body.context = context.map(({ type, id }) => ({ type, id }))
  return api.post('/ai/koios/chat', body).then((r) => r.data)
}

// Load the Koios settings (selectable models + connection/policy status).
export const getKoiosSettings = () => api.get('/ai/koios/settings').then((r) => r.data)
