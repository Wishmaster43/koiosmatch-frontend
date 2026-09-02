/**
 * webhookRequestsApi — the INBOUND webhook request log's axios calls
 * (WEBHOOK-LOG-FE-1), split out of settings/webhooksApi.js so the request-log
 * machinery (shared by Settings and the workflow editor's config panel,
 * WEBHOOK-LOG-FE-2) does not import across the pages/ boundary (§2 barrel rule).
 */
import api, { unwrap, unwrapList } from '@/lib/api'

// Paginated summary rows, newest first, deliberately WITHOUT headers/body
// (list is a summary; body/headers are detail-only).
export const listWebhookRequests = (webhookId: string | number, page = 1, perPage = 50) =>
  api.get(`/webhooks/${webhookId}/requests`, { params: { page, per_page: perPage } }).then(unwrapList)

// One request's full detail (headers/query/body/response_body). Resolved by the
// PARENT webhook (kind-door-ouder, IDOR) — a request under the wrong webhook 404s.
export const getWebhookRequest = (webhookId: string | number, requestId: string | number) =>
  api.get(`/webhooks/${webhookId}/requests/${requestId}`).then(unwrap)
