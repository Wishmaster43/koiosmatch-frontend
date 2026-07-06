/**
 * geocode — resolve a Dutch postcode/place/address to coordinates via the PDOK
 * Locatieserver (the same public source the backend uses; free, no key, no PII —
 * the query is a place name). Used by the radius filter block in the sidebar.
 */

export interface GeoHit { lat: number; lng: number; label: string }

// PDOK free-search endpoint; one best hit limited to place-like types.
const PDOK_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free'

/** Geocode a free-text NL location; returns null when nothing matches. */
export async function geocodeNL(query: string): Promise<GeoHit | null> {
  const q = query.trim()
  if (!q) return null
  const params = new URLSearchParams({
    q, rows: '1',
    fl: 'centroide_ll,weergavenaam',
    fq: 'type:(woonplaats OR postcode OR adres)',
  })
  try {
    const res = await fetch(`${PDOK_URL}?${params}`)
    if (!res.ok) return null
    const json = await res.json() as { response?: { docs?: Array<{ centroide_ll?: string; weergavenaam?: string }> } }
    const doc = json.response?.docs?.[0]
    // centroide_ll is WKT: "POINT(lng lat)".
    const m = doc?.centroide_ll?.match(/POINT\(([\d.-]+) ([\d.-]+)\)/)
    if (!m) return null
    return { lng: Number(m[1]), lat: Number(m[2]), label: doc?.weergavenaam ?? q }
  } catch {
    return null
  }
}
