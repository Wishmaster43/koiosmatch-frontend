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

/**
 * countPendingGeocode — rows that HAVE an address (city filled) but no coordinates
 * yet, i.e. still queued for the background geocoder. `city` is the "has an
 * address" signal: a row without any address can never land on the map (a
 * different, unrelated problem) and must not inflate this count.
 */
export function countPendingGeocode<T extends { lat?: unknown; lng?: unknown; city?: string | null }>(rows: T[]): number {
  return rows.reduce((n, r) => {
    const missingCoords = toCoord(r.lat) == null || toCoord(r.lng) == null
    return missingCoords && Boolean(r.city) ? n + 1 : n
  }, 0)
}
