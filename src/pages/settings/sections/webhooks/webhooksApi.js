/**
 * webhooksApi — axios calls for OUTGOING webhook subscriptions. These are
 * separate from the existing inbound `/webhooks` (workflow triggers); they live
 * under `/webhook-subscriptions`. The signing secret is returned only by create
 * and regenerate, and is never stored client-side beyond the one-time reveal.
 */
import api, { unwrap, unwrapList } from '../../../../lib/api'

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
