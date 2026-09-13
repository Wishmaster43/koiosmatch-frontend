/**
 * geoFilter — shared geo-search helper for filter panels (candidates, customers).
 * `applyGeo` geocodes user input via PDOK and updates both the filter state and
 * map state (centre + radius) on success; on failure, shows a hint instead.
 * Takes setters as arguments (never managing state itself) so it works with
 * both useState and usePageMemory in different callers.
 */
import { useCallback } from 'react'
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

// useApplyGeoFilter — stabilized applyGeo() call shared by every filter-panel
// hook (candidates, customers, …): wraps the raw applyGeo() in a useCallback so
// a page's filterGroups useMemo can safely depend on it (every captured setter
// is itself stable — usePageMemory/useState — only `t` can genuinely change).
export function useApplyGeoFilter(
  t: (k: string) => string,
  setGeoHint: (hint: string | null) => void,
  setGeoFilter: (filter: GeoFilter | null) => void,
  setMapCenter: (pt: { lat: number; lng: number }) => void,
  setMapRadius: (r: number) => void,
) {
  return useCallback(async (q: string, km: number) => {
    return applyGeo(q, km, t('common:filters.notFound'), setGeoHint, setGeoFilter, setMapCenter, setMapRadius)
  }, [t, setGeoHint, setGeoFilter, setMapCenter, setMapRadius])
}
