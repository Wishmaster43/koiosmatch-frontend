/**
 * Shared primitive type helpers used across the entity type modules.
 */

/** Loose nested record whose exact fields vary by backend version. */
export type Loose = Record<string, unknown>

/** An id as the backend may send it (UUID string, or a legacy/optimistic number). */
export type Id = string | number
