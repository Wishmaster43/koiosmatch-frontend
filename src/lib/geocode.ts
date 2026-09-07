/**
 * geocode — resolve a postcode/place/address to coordinates via the backend
 * OpenCage proxy (GEO-GEOCODE-SEARCH-1). Works for all countries, gated by view
 * permission + tenant daily budget. Used by the radius filter block in the sidebar.
 */

import api from '@/lib/api'

export interface GeoHit { lat: number; lng: number; label?: string | null }

/** Geocode a free-text location; returns null on empty input, miss, or error. */
export async function geocodeLocation(query: string, country?: string): Promise<GeoHit | null> {
  const q = query.trim()
  if (!q) return null
  try {
    const params: Record<string, string> = { q }
    if (country) params.country = country
    const res = await api.get<{ data: GeoHit }>('/api/geocode/search', { params })
    return res.data.data
  } catch {
    // 404 = not found, 429/503 = provider issues — all return null
    return null
  }
}

/** Legacy alias for NL-only queries (kept for backward compatibility with radius filter). */
export async function geocodeNL(query: string): Promise<GeoHit | null> {
  return geocodeLocation(query, 'NL')
}
