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
): { errors: Record<string, boolean>; messages: Record<string, string> } | null {
  const apiErrors = (err as ApiErrorResponse)?.response?.data?.errors
  if (!apiErrors) return null
  const errors: Record<string, boolean> = {}
  const messages: Record<string, string> = {}
  Object.entries(apiErrors).forEach(([key, value]) => {
    const field = apiToForm[key] ?? key
    errors[field] = true
    const msg = Array.isArray(value) ? value[0] : value
    if (typeof msg === 'string') messages[field] = msg
  })
  return { errors, messages }
}
