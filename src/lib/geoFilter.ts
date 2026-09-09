/**
 * geoFilter — shared geo-search helper for filter panels (candidates, customers).
 * `applyGeo` geocodes user input via PDOK and updates both the filter state and
 * map state (centre + radius) on success; on failure, shows a hint instead.
 * Takes setters as arguments (never managing state itself) so it works with
 * both useState and usePageMemory in different callers.
 */
import { geocodeLocation } from './geocode'

export interface GeoFilter {
  q: string
  km: number
  lat: number
  lng: number
  label: string
}

// Geocode `q` via PDOK; on success, update the filter + map state.
// On failure, show the caller's translated not-found hint. Inputs `setGeoHint`, `setGeoFilter`, `setMapCenter`,
// `setMapRadius` are mutators (useState setters or custom equivalents).
export async function applyGeo(
  q: string,
  km: number,
  notFoundHint: string,
  setGeoHint: (hint: string | null) => void,
  setGeoFilter: (filter: GeoFilter) => void,
  setMapCenter: (pt: { lat: number; lng: number }) => void,
  setMapRadius: (r: number) => void,
): Promise<void> {
  setGeoHint(null)
  const hit = await geocodeLocation(q)
  if (!hit) {
    setGeoHint(notFoundHint)
    return
  }
  setGeoFilter({ q, km, lat: hit.lat, lng: hit.lng, label: `${hit.label} · ${km} km` })
  setMapCenter({ lat: hit.lat, lng: hit.lng })
  setMapRadius(km)
}
