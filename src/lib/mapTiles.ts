/**
 * mapTiles — the single source of the map tile provider (M-004, decision 12b = A:
 * a paid EU tile provider WITH a data-processing agreement). The URL template and
 * attribution come from VITE_MAP_TILE_URL / VITE_MAP_TILE_ATTRIBUTION; a provider
 * key is a public, domain-locked key and lives inside the URL template. The OSM
 * values below are a fallback ONLY while no provider is configured.
 * Pure (no import.meta at call time) so csp.ts can run it inside the Vite config.
 */

export interface MapTileEnv {
  VITE_MAP_TILE_URL?: string
  VITE_MAP_TILE_ATTRIBUTION?: string
}

export interface MapTiles { url: string; attribution: string; origin: string }

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

// Derives the CSP img-src origin from a tile template; a "{s}." subdomain becomes a wildcard.
function originOfTemplate(template: string): string {
  const wildcard = template.includes('{s}.')
  try {
    const origin = new URL(template.replace('{s}.', '')).origin
    return wildcard ? origin.replace('://', '://*.') : origin
  } catch {
    return ''
  }
}

// Resolves the active tile provider from env, falling back to OSM when none is set.
export function resolveMapTiles(env: MapTileEnv): MapTiles {
  const url = env.VITE_MAP_TILE_URL?.trim() || OSM_URL
  // Provider tiles are OSM-based (ODbL), so an empty attribution env still keeps the OSM credit.
  const attribution = env.VITE_MAP_TILE_ATTRIBUTION?.trim() || OSM_ATTRIBUTION
  return { url, attribution, origin: originOfTemplate(url) }
}

// import.meta.env is absent when the Vite config bundles csp.ts, hence the empty fallback.
export const mapTiles: MapTiles = resolveMapTiles((import.meta.env ?? {}) as MapTileEnv)
