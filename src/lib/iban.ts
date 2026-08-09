/**
 * iban — display/wire helpers for a bank account number. FORMATTING ONLY: there
 * is deliberately NO mod-97 check here. The backend validates every IBAN it is
 * sent (measured 2026-08-09 against the dev API: PATCH /candidates/{id} answers
 * 422 {"message":"Het IBAN-controlegetal klopt niet.","errors":{"iban":[…]}} for
 * the private account and the same message under `freelance.iban` for the
 * business one), and two validators that drift apart is worse than one — so the
 * front-end only makes the value READABLE and leaves the verdict to the server.
 *
 * Shared on purpose (§11): the candidate's private bank card AND the ZZP
 * Facturatie block both go through these two functions, never a local copy.
 */

/**
 * Wire form — no spaces, uppercase. The API stores what it is sent VERBATIM
 * (measured: "NL91 ABNA 0417 1643 00" came back with its spaces intact), so
 * every write path normalises here first and the stored value stays canonical.
 * Covers the non-breaking space a paste from a bank statement can carry.
 */
export function normalizeIban(value: unknown): string {
  return String(value ?? '').replace(/[\s\u00A0]/g, '').toUpperCase()
}

/**
 * Display form — canonical groups of four ("NL91 ABNA 0417 1643 00"), which is
 * how a human reads and checks an account number. Empty in, empty out (the
 * caller decides what a missing value looks like).
 */
export function formatIban(value: unknown): string {
  const raw = normalizeIban(value)
  return raw ? (raw.match(/.{1,4}/g) ?? []).join(' ') : ''
}
