/**
 * koiosApi — axios calls for the Koios settings area (settings · usage · admin).
 *
 * Backend contract (baseURL already adds /api):
 *   GET /ai/koios/settings → { models{active,selectable[]}, pricing{model:{input,output}},
 *                              currency, status{claude_configured, policy_loaded} }
 */
import api, { unwrap } from '../../../../lib/api'

// Tenant Koios settings: active/selectable models, pricing, connection status.
export const getKoiosSettings = () => api.get('/ai/koios/settings').then(unwrap)
