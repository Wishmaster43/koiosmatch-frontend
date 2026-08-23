/**
 * webhookRequestTypes — shapes for the inbound-webhook request log (WEBHOOK-LOG-FE-1).
 * Hand-written (§10): the generated openapi spec documents only the 401 error
 * response for these two endpoints, no 2xx success schema yet, so the real
 * shapes come from the backend contract (K-117) instead of api-generated.ts.
 */

// One list row — deliberately WITHOUT headers/body (list is a summary only).
export interface WebhookRequestRow {
  id: string
  method: string
  status_code: number
  ip: string | null
  workflow_ids: Array<string | number>
  created_at: string
}

// Full detail: headers are pre-filtered by the backend, masked entries carry
// the literal string "[MASKED]" as their value. body is capped at 64KB server-side.
export interface WebhookRequestDetail extends WebhookRequestRow {
  headers: Record<string, string>
  query: Record<string, string>
  body: string | null
  response_body: string | null
}
