import { DUPLICATE_CONTACT_ID_KEY } from './duplicateContactError'

/**
 * extractFormErrors — map a Laravel 422 validation bag onto the form's own field keys
 * (snake_case API key → camelCase form key via the caller's API_TO_FORM map). Returns
 * null when the response carries no bag, so the caller falls back to its own toast /
 * banner through extractApiError — exactly what the three former copies did
 * (DUP-04 review finding: never toast the bag's raw Laravel sentence on top of the
 * inline errors it already explains).
 */
interface ApiErrorResponse { response?: { data?: { errors?: Record<string, unknown> } } }

// Field-presence map for the form, or null when the error carries no validation bag.
export function extractFormErrors(err: unknown, apiToForm: Record<string, string>): Record<string, boolean> | null {
  const apiErrors = (err as ApiErrorResponse)?.response?.data?.errors
  if (!apiErrors) return null
  const formErrors: Record<string, boolean> = {}
  Object.keys(apiErrors).forEach(key => { formErrors[apiToForm[key] ?? key] = true })
  return formErrors
}

// extractFormErrorsWithMessages — the same 422-bag mapping as extractFormErrors,
// PLUS the server's own per-field message text (VALIDATIE-LIVE-1: the message is
// kept, never wiped, alongside the red-border boolean flag). Laravel 422 payloads
// carry an array of messages per field — the first one is kept. Returns null when
// the error carries no validation bag, so the caller falls back to its own
// toast/banner through extractApiError — same contract as extractFormErrors.
export function extractFormErrorsWithMessages(
  err: unknown, apiToForm: Record<string, string>,
): { errors: Record<string, boolean>; messages: Record<string, string>; unmapped: UnmappedEntry[] } | null {
  const apiErrors = (err as ApiErrorResponse)?.response?.data?.errors
  if (!apiErrors) return null
  const errors: Record<string, boolean> = {}
  const messages: Record<string, string> = {}
  Object.entries(apiErrors).forEach(([key, value]) => {
    // N-001: the existing-contact id is metadata, never a field error.
    if (key === DUPLICATE_CONTACT_ID_KEY) return
    const field = apiToForm[key] ?? key
    errors[field] = true
    const msg = Array.isArray(value) ? value[0] : value
    if (typeof msg === 'string') messages[field] = msg
  })
  return { errors, messages, unmapped: unmappedFormErrors(err, apiToForm) }
}

// ONIX N-005: a 422 bag entry whose key no rendered field maps to (the caller's
// apiToForm has no entry for it, or — when renderedKeys is given — the key is
// not among the keys an actual input shows), so it would otherwise disappear.
export interface UnmappedEntry { key: string; message: string | null }

// unmappedFormErrors — the bag entries no form field will ever display: not in
// apiToForm AND (renderedKeys given: not in renderedKeys; renderedKeys absent:
// the key is a nested/dotted key such as `custom_fields.vog`, which no flat
// form field can render). Pure — never called without a bag already confirmed.
export function unmappedFormErrors(
  err: unknown, apiToForm: Record<string, string>, renderedKeys?: string[],
): UnmappedEntry[] {
  const apiErrors = (err as ApiErrorResponse)?.response?.data?.errors
  if (!apiErrors) return []
  const rendered = renderedKeys ? new Set(renderedKeys) : null
  return Object.entries(apiErrors)
    .filter(([key]) => {
      if (key === DUPLICATE_CONTACT_ID_KEY) return false
      if (apiToForm[key] !== undefined) return false
      return rendered ? !rendered.has(key) : key.includes('.')
    })
    .map(([key, value]) => {
      const msg = Array.isArray(value) ? value[0] : value
      return { key, message: typeof msg === 'string' ? msg : null }
    })
}
