/**
 * webhooksApi — axios calls for OUTGOING webhook subscriptions, plus the
 * INBOUND webhook request log (WEBHOOK-LOG-FE-1). Outgoing subscriptions are
 * separate from the existing inbound `/webhooks` (workflow triggers); they live
 * under `/webhook-subscriptions`. The signing secret is returned only by create
 * and regenerate, and is never stored client-side beyond the one-time reveal.
 */
import api, { unwrap, unwrapList } from '@/lib/api'

// List all subscriptions for the active tenant (no signing secret).
export const listSubscriptions = () => api.get('/webhook-subscriptions').then(unwrapList)

// Full detail incl. event_types and url (no secret).
export const getSubscription = (id) => api.get(`/webhook-subscriptions/${id}`).then(unwrap)

// Create; the response carries the plaintext signing secret exactly once.
export const createSubscription = (body) => api.post('/webhook-subscriptions', body).then((r) => r.data)

// Update name / url / status / event_types.
export const updateSubscription = (id, body) => api.put(`/webhook-subscriptions/${id}`, body).then(unwrap)

// Delete a subscription.
export const deleteSubscription = (id) => api.delete(`/webhook-subscriptions/${id}`)

// Rotate the signing secret; response carries the new plaintext secret once.
export const regenerateSecret = (id) => api.post(`/webhook-subscriptions/${id}/regenerate-secret`).then((r) => r.data)

// INBOUND webhook request log (K-117): paginated summary rows, newest first,
// deliberately WITHOUT headers/body (list is a summary; body/headers are detail-only).
export const listWebhookRequests = (webhookId, page = 1, perPage = 50) =>
  api.get(`/webhooks/${webhookId}/requests`, { params: { page, per_page: perPage } }).then(unwrapList)

// One request's full detail (headers/query/body/response_body). Resolved by the
// PARENT webhook (kind-door-ouder, IDOR) — a request under the wrong webhook 404s.
export const getWebhookRequest = (webhookId, requestId) =>
  api.get(`/webhooks/${webhookId}/requests/${requestId}`).then(unwrap)
