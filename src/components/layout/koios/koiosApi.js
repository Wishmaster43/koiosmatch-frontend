/**
 * koiosApi — axios calls for the Koios AI assistant (baseURL already adds /api).
 *
 * Backend contract:
 *   POST /api/ai/koios/chat      { message, model? }
 *     → { answer, steps[], model, stop_reason, usage{input_tokens,output_tokens,calls,cost,currency} }
 *   GET  /api/ai/koios/settings  → { models{active,selectable[]}, pricing, currency, status{...} }
 *
 * /chat is synchronous (no streaming) and can take a few seconds — the caller
 * shows a loading state.
 */
import api from '../../../lib/api'

// Send one chat turn. `model` is optional (defaults to the tenant's active model).
export const sendChat = (message, model) =>
  api.post('/ai/koios/chat', model ? { message, model } : { message }).then((r) => r.data)

// Load the Koios settings (selectable models + connection/policy status).
export const getKoiosSettings = () => api.get('/ai/koios/settings').then((r) => r.data)
