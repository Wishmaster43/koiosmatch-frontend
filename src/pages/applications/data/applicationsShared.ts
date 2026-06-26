/**
 * Shared, non-mock helpers for the applications feature. Pure functions only —
 * safe to use on real API data (no demo/fallback rows live here).
 */

// The three list buckets are derived from the phase key: hired = matched,
// rejected = rejected, everything else = active.
export const bucketOfPhase = (key: string): string =>
  key === 'rejected' ? 'rejected' : key === 'hired' ? 'matched' : 'active'
