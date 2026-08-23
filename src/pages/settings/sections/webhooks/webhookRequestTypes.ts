/**
 * webhookRequestTypes — shapes for the inbound-webhook request log (WEBHOOK-LOG-FE-1).
 * Hand-written (§10): the generated openapi spec documents only the 401 error
 * response for these two endpoints, no 2xx success schema yet, so the real
 * shapes come from the backend contract (K-117) instead of api-generated.ts.
 */

// A workflow reference by name — WEBHOOK-RUN-CORRELATION-1: the backend now
// attaches the display name next to the bare id, so a request row can link to
// each workflow's own run history instead of a generic pointer.
export interface WebhookRequestWorkflowRef {
  id: string | number
  // Null for a workflow hard-erased after the request row was logged (requests
  // live 30 days; workflows can be erased sooner) — render falls back to #id.
  name: string | null
}

// One list row — deliberately WITHOUT headers/body (list is a summary only).
export interface WebhookRequestRow {
  id: string
  method: string
  status_code: number
  ip: string | null
  // Null for rows that matched no workflow (401 signature-rejected, bare 200
  // received) — the recorder stores `?: null`, and Laravel's array cast passes
  // null through. Callers guard with `?? []`.
  workflow_ids: Array<string | number> | null
  // Optional: absent on rows logged before WEBHOOK-RUN-CORRELATION-1 — those keep
  // rendering the honest ids-only fallback (WorkflowRefs).
  workflows?: WebhookRequestWorkflowRef[]
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
