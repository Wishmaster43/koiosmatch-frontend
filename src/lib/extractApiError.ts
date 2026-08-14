/**
 * extractApiError — one place that turns an axios error into a human message
 * (audit R1: the `message ?? first-validation-error` dance was copy-pasted 4×
 * across pages). Preference order: Laravel validation bag's first message →
 * server `message` → the caller's fallback (an i18n'd string — never leak a
 * raw axios/network string to the UI).
 */
interface ServerErrorBody { message?: string; code?: string; errors?: Record<string, string[]> }

export function extractApiError(err: unknown, fallback: string): string {
  const body = (err as { response?: { data?: ServerErrorBody } })?.response?.data
  const firstValidation = body?.errors ? Object.values(body.errors)[0]?.[0] : undefined
  return firstValidation ?? body?.message ?? fallback
}

/**
 * Backend error CODES we translate ourselves (CMBE 09-08, commit 456ac45b). The
 * `code` is the stable contract; the server's Dutch `message` is only a fallback
 * and must never be shown raw to a non-NL tenant (§5/§10). Covers every Koios
 * surface at once — chat, notes-assist, generate and conversation-assist all pass
 * through one translation layer in the backend's ClaudeClient.
 */
const ERROR_CODE_KEYS: Record<string, string> = {
  koios_credit_exhausted: 'errors.koiosCreditExhausted',
  koios_unavailable: 'errors.koiosUnavailable',
  // HF-CONTRACTMAP-1: the manual send-to-HelloFlex path returns this 409 when the
  // match's contract form has no row in Settings → HelloFlex → Contractmap yet —
  // an honest "not configured" notice, never a raw server message.
  helloflex_contract_type_unmapped: 'errors.helloflexContractTypeUnmapped',
}

/**
 * The `common` i18n key for a known backend error code, or null when the code is
 * absent/unknown — the caller then falls back to extractApiError. Matching on the
 * code (never on the message text) is what keeps this stable when the backend
 * rewords its copy.
 */
export function apiErrorKey(err: unknown): string | null {
  const code = (err as { response?: { data?: ServerErrorBody } })?.response?.data?.code
  return (code && ERROR_CODE_KEYS[code]) ?? null
}

/**
 * A known-code error is EXPECTED, not a crash: an empty credit balance (402) or a
 * temporary outage (503) is something the recruiter can act on or wait out, so the
 * UI shows it as a calm warning rather than a red failure.
 */
export function isExpectedApiError(err: unknown): boolean {
  return apiErrorKey(err) !== null
}
