/**
 * toCoord — tolerant numeric coercion for geo fields (lat/lng/distance_km).
 * Laravel serialises DECIMAL columns as JSON *strings* ("53.2185923"), so the
 * old `typeof x === 'number'` checks in the entity mappers silently dropped
 * real coordinates to null — the PDOK panel then showed "not geocoded" for
 * geocoded candidates (CMBE bug report 2026-07-22, K-00286). Accept number or
 * numeric string; anything else (null/undefined/'') maps to null.
 */
export function toCoord(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}
