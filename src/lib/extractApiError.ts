/**
 * extractApiError — one place that turns an axios error into a human message
 * (audit R1: the `message ?? first-validation-error` dance was copy-pasted 4×
 * across pages). Preference order: Laravel validation bag's first message →
 * server `message` → the caller's fallback (an i18n'd string — never leak a
 * raw axios/network string to the UI).
 */
interface ServerErrorBody { message?: string; code?: string; errors?: Record<string, string[]> }

// KAND-ACHTERGROND-VERPLICHT-1 (2026-08-17): Laravel's OWN default "required"
// validation copy (vendor lang/en/validation.php: 'The :attribute field is
// required.'). The API has `APP_LOCALE=nl` but ships no lang/nl/validation.php
// (verified in koiosmatch-api/lang — only vacancies/guard/customers/contacts are
// translated), so this template always falls through to the English default and
// reaches the client raw, naming the raw column ("employer") instead of the
// label the user sees — the exact toast Danny screenshotted. Every message a
// controller crafts by hand (DocumentOwnershipGuard, guard.*, the domain 409s
// throughout app/Http/Controllers) is authored Dutch/English prose and never
// matches this literal template, so the fingerprint safely tells the two apart
// without touching any of those already-working, already-readable messages.
const RAW_REQUIRED_RE = /^The .+ field is required\.$/

/**
 * @param fieldLabels Optional map of backend field key → an ALREADY-TRANSLATED
 * message (built by the caller via `t()`, since this helper has no i18n access
 * and runs outside render too). Only consulted when the raw validation message
 * is Laravel's own untranslated "required" template — a crafted domain message
 * always wins as before. Unknown/absent field → the caller's generic `fallback`,
 * never the raw server sentence.
 */
export function extractApiError(err: unknown, fallback: string, fieldLabels?: Record<string, string>): string {
  const body = (err as { response?: { data?: ServerErrorBody } })?.response?.data
  const entries = body?.errors ? Object.entries(body.errors) : []
  const [field, messages] = entries[0] ?? []
  const raw = messages?.[0]
  if (raw && RAW_REQUIRED_RE.test(raw)) {
    return (field && fieldLabels?.[field]) ? fieldLabels[field] : fallback
  }
  return raw ?? body?.message ?? fallback
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
