/**
 * extractApiError — one place that turns an axios error into a human message
 * (audit R1: the `message ?? first-validation-error` dance was copy-pasted 4×
 * across pages). Preference order: Laravel validation bag's first message →
 * server `message` → the caller's fallback (an i18n'd string — never leak a
 * raw axios/network string to the UI).
 */
interface ServerErrorBody { message?: string; errors?: Record<string, string[]> }

export function extractApiError(err: unknown, fallback: string): string {
  const body = (err as { response?: { data?: ServerErrorBody } })?.response?.data
  const firstValidation = body?.errors ? Object.values(body.errors)[0]?.[0] : undefined
  return firstValidation ?? body?.message ?? fallback
}
