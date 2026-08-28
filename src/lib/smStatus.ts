/**
 * smStatus — Shiftmanager's OWN external status vocabulary (§10 sm_-mirror):
 * deliberately non-English values (§0.1 covers our identifiers, not external
 * API data) and never a tenant lookup — Shiftmanager defines this set, not the
 * tenant. v2 (mega-audit r2): the set is COMPLETE (extern/onbekend joined),
 * normalisation is hardened against non-string mirror values and strips
 * whitespace, so "Niet actief" and "nietactief" land on the same key — the
 * KPI count, the donut, the filter and the drawer chip all share one truth.
 */
export const SM_STATUS = {
  ACTIVE: 'actief',
  INACTIVE: 'nietactief',
  INTAKE: 'intake',
  DELETED: 'verwijderd',
  EXTERNAL: 'extern',
  UNKNOWN: 'onbekend',
} as const

// One normalisation for a RAW status value: string-coerced (mirror rows are
// untyped), lowercased, whitespace-stripped, empty/null → onbekend.
export const normalizeSmStatus = (status?: unknown): string => {
  const s = String(status ?? '').trim().toLowerCase().replace(/\s+/g, '')
  return s || SM_STATUS.UNKNOWN
}

// The record-level convenience every count/filter/chip goes through.
export const statusOf = (c: { status?: unknown }) => normalizeSmStatus(c?.status)
