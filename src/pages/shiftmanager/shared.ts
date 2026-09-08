/**
 * shiftmanager — PUBLIC surface (§2 barrel decision, Danny 21-08).
 * Everything another entity may import from this folder lives HERE; anything
 * not exported below is internal and off-limits cross-entity (lint-enforced).
 * Whoever changes a module re-exported here knows outsiders ride along —
 * extend this list deliberately, never bypass it with a deep import.
 */
export { cancellationsOf, endDateOf, featureNamesOf, noShowCountOf } from './data/smCandidateFields'
export { SM_CANDIDATE_STATUS_COLORS } from './data/smCandidateStatus'

// Shiftmanager customer status colours (tokens, never hardcoded hex).
export const STATUS_COLORS: Record<string, string> = {
  actief: 'var(--color-success)',
  prospect: 'var(--color-secondary)',
  inactief: 'var(--color-warning)',
  geblokkeerd: 'var(--color-danger)',
}

// Count all departments across a customer's locations.
export const deptCount = (c: { locations?: Array<{ departments?: unknown[] }> }): number =>
  (c.locations ?? []).reduce((s, l) => s + (l.departments?.length ?? 0), 0)
