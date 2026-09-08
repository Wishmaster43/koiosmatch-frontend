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
