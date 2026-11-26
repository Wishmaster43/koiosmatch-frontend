/**
 * whatsappTextTemplatesApi (WA-WEB-TEMPLATES-1, Danny 23-11 Q15): tenant text templates for
 * the wa_web channel. BE contract (CMBE 23-11, lane after batch K): GET /whatsapp-text-templates
 * (page.whatsapp) answers `{ data: rows, meta: { placeholders } }`, the bureau's placeholder
 * names also when `data` is empty (ONE source, the rows carry none); POST, PUT /{id} and
 * DELETE /{id} (settings.update) manage them. Placeholders are NAMED like the workflow steps
 * ({{first_name}}), never WABA numbering; the BE renders them against the conversation's
 * candidate at send time. Hand-written types: the OpenAPI export carries no 2xx schema yet.
 */
import api, { unwrap, unwrapList } from '@/lib/api'
import { withIdempotencyKey } from '@/lib/idempotency'

// The ONE route constant: the only line that changes if the BE lands the route elsewhere.
export const WHATSAPP_TEXT_TEMPLATES_ROUTE = '/whatsapp-text-templates'

// One template row as the BE serialises it (snake_case, verbatim).
export interface WhatsappTextTemplate {
  id: string
  name: string
  body: string
  // Locale code of the template text ("nl", "en", ...), chosen by the tenant.
  language: string
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

// The writable fields of a template (create and update share one body).
export interface WhatsappTextTemplateInput {
  name: string
  body: string
  language: string
  is_active: boolean
}

// The list answer: the rows plus the bureau's placeholder names from `meta` (without braces).
export interface WhatsappTextTemplateList {
  rows: WhatsappTextTemplate[]
  placeholders: string[]
}

// Reads `meta.placeholders` tolerantly: a missing or malformed meta yields an empty list.
function readPlaceholders(res: unknown): string[] {
  const meta = (res as { data?: { meta?: { placeholders?: unknown } } })?.data?.meta
  const raw = meta?.placeholders
  return Array.isArray(raw) ? raw.filter((p): p is string => typeof p === 'string') : []
}

// GET: the tenant's templates (every status; the composer filters on is_active itself) + placeholders.
// 403 (no whatsapp page) and 404 (route not landed yet) are the caller's own empty state, never a toast:
// the composer renders no picker and the settings screen its load banner (the client toasts otherwise).
export async function listWhatsappTextTemplates(signal?: AbortSignal): Promise<WhatsappTextTemplateList> {
  const res = await api.get(WHATSAPP_TEXT_TEMPLATES_ROUTE, { signal, quietStatuses: [403, 404] })
  return { rows: unwrapList<WhatsappTextTemplate>(res).rows, placeholders: readPlaceholders(res) }
}

// POST: create one template; idempotent on retry, 422 left to the caller to render.
export async function createWhatsappTextTemplate(input: WhatsappTextTemplateInput): Promise<WhatsappTextTemplate> {
  const res = await api.post(WHATSAPP_TEXT_TEMPLATES_ROUTE, input, withIdempotencyKey({ quietStatuses: [422] }))
  return unwrap<WhatsappTextTemplate>(res)
}

// PUT: replace the writable fields of one template.
export async function updateWhatsappTextTemplate(id: string, input: WhatsappTextTemplateInput): Promise<WhatsappTextTemplate> {
  const res = await api.put(`${WHATSAPP_TEXT_TEMPLATES_ROUTE}/${id}`, input, { quietStatuses: [422] })
  return unwrap<WhatsappTextTemplate>(res)
}

// DELETE: remove one template (the BE answers 204).
export async function deleteWhatsappTextTemplate(id: string): Promise<void> {
  await api.delete(`${WHATSAPP_TEXT_TEMPLATES_ROUTE}/${id}`)
}
