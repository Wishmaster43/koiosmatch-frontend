/**
 * Shared primitive type helpers used across the entity type modules.
 */

/** Loose nested record whose exact fields vary by backend version. */
export type Loose = Record<string, unknown>

/** An id as the backend may send it (UUID string, or a legacy/optimistic number). */
export type Id = string | number

/** A tenant-lookup option (status, funnel, candidate-type, …) as the UI uses it. */
export interface LookupOption {
  value: string
  label: string
  color?: string
  count?: number
  // KLANT-BLACKLIST-PROMPT-1: passed through by normalizeOptions when the lookup
  // row carries `is_blacklist` (customer/candidate statuses) — drives the
  // status-reason prompt gate.
  isBlacklist?: boolean
  // N008-DOC-EXPIRY-FE-1: passed through by useDocumentTypes' own toOption when
  // the lookup row carries `requires_expiry` / `default_validity_months` — drives
  // the pending-upload expiry field. Absent on every other lookup.
  requiresExpiry?: boolean
  defaultValidityMonths?: number | null
  [k: string]: unknown
}
