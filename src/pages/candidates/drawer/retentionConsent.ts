/**
 * retentionConsent — what a candidate's retention consent is WORTH right now.
 *
 * Measured against the backend (CandidateRetentionPolicy, AVG-RET-2 §2, verified
 * 2026-08-02): a granted consent protects a dossier only while `retention_consent_at`
 * falls inside the tenant's `retention_consent_months` window. The expiry is
 * IMPERATIVE — the policy query and the nightly `retention:candidates` command apply
 * it regardless of any workflow. The "vraag bewaartoestemming" workflow only ASKS the
 * candidate to renew, so a tenant who switches that workflow off still gets expiry.
 * This module exists so the UI tells exactly that story instead of a checkbox that
 * claims "may be kept" three months after the consent lapsed.
 *
 * Backend branches mirrored 1:1 (CandidateRetentionPolicy::expiresAt/excludeValidConsent):
 *  - months = 0            → the tenant DELIBERATELY wants consent to never expire.
 *  - consent without a date → cannot be proven current, so it counts as expired.
 *  - otherwise             → valid until consent_at + months, lapsed after it.
 */

/** Tenant setting (GET /settings) governing how long a granted consent stays valid. */
export const RETENTION_CONSENT_MONTHS_KEY = 'retention_consent_months'

/** Backend default when the tenant never set the key (CandidateRetentionPolicy::DEFAULT_CONSENT_MONTHS). */
export const DEFAULT_RETENTION_CONSENT_MONTHS = 24

/**
 * The consent's current worth. `unknownWindow` is honest ignorance (the tenant
 * setting could not be read) — never a guessed date.
 */
export type RetentionConsentState =
  | { kind: 'none' }
  | { kind: 'unknownWindow' }
  | { kind: 'indefinite' }
  | { kind: 'undated' }
  | { kind: 'valid'; until: Date }
  | { kind: 'lapsed'; since: Date }

/**
 * Add whole months, matching PHP/Carbon's `addMonths` OVERFLOW semantics (31-01 + 1
 * month = 03-03, not 28-02) so the FE never shows a date the backend disagrees with.
 * JS `setMonth` overflows the same way — that equivalence is the reason this is safe.
 */
export function addMonths(from: Date, months: number): Date {
  const out = new Date(from.getTime())
  out.setMonth(out.getMonth() + months)
  return out
}

/**
 * Coerce the tenant setting to months. Laravel serialises settings as STRINGS (§10),
 * so this stays tolerant; a missing key means "tenant never set it" → the backend
 * default applies, and negatives are floored to 0 exactly like `max(0, (int) $value)`.
 * Returns null only when the payload itself is unusable (caller shows "unknown").
 */
export function readConsentMonths(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null
  const raw = (payload as Record<string, unknown>)[RETENTION_CONSENT_MONTHS_KEY]
  if (raw === undefined || raw === null || raw === '') return DEFAULT_RETENTION_CONSENT_MONTHS
  const n = Number(raw)
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : DEFAULT_RETENTION_CONSENT_MONTHS
}

/** Inputs for the derivation — all four come from data we actually have on screen. */
export interface RetentionConsentInput {
  /** `consent.retention_opt_in` from the candidate resource. */
  optIn: boolean
  /** `consent.retention_consent_at` (ISO8601) — the provenance stamp the window is measured from. */
  consentAt: string | null | undefined
  /** Tenant `retention_consent_months`; null = could not be resolved. */
  months: number | null
  /** Injectable clock so the lapse boundary is deterministically testable. */
  now?: Date
}

/**
 * Resolve the consent state. Order mirrors the backend so the UI can never claim
 * protection the nightly command does not honour.
 */
export function resolveRetentionConsent({ optIn, consentAt, months, now = new Date() }: RetentionConsentInput): RetentionConsentState {
  // No consent on file — the stored `consent_at` may still hold historical evidence
  // of an earlier grant, but it protects nothing, so it is not shown as validity.
  if (!optIn) return { kind: 'none' }

  // The window could not be read; say so rather than inventing a date.
  if (months === null) return { kind: 'unknownWindow' }

  // 0 is a deliberate tenant choice, not an empty value — word it as such.
  if (months <= 0) return { kind: 'indefinite' }

  // Consent flag without a provenance stamp: the backend cannot prove it is current
  // and treats it as unprotected, so neither do we.
  const stamped = consentAt ? new Date(consentAt) : null
  if (!stamped || Number.isNaN(stamped.getTime())) return { kind: 'undated' }

  const lapsesAt = addMonths(stamped, months)
  return lapsesAt.getTime() > now.getTime() ? { kind: 'valid', until: lapsesAt } : { kind: 'lapsed', since: lapsesAt }
}
