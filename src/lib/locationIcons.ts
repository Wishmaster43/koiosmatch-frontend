/**
 * locationIcons — the curated lucide set a tenant branch (vestiging) can brand
 * itself with (VESTIGING-ICOON-1), plus the neutral defaults a brand-new row
 * starts from.
 *
 * Pure vocabulary + one resolver, owned here because TWO surfaces need it: the
 * Settings icon picker and the per-row LocationBadge. It was written inline in
 * LocationsSettings.jsx only because the task that added it could not create
 * files; this is its real home, next to roleIcons.ts and mirroring the
 * document-type map (useDocumentTypes.ts' DOC_TYPE_ICON_MAP/resolveDocTypeIcon).
 * Keys are the slugs Store/UpdateLocationRequest persist and LocationResource
 * returns as-is — never a display label.
 */
import type { LucideIcon } from 'lucide-react'
import { Building2, Building, Home, Store, Warehouse, Landmark, MapPin, Briefcase } from 'lucide-react'

// slug → lucide component (verified real lucide-react exports).
export const LOCATION_ICON_MAP: Record<string, LucideIcon> = {
  'building-2': Building2, building: Building, home: Home, store: Store,
  warehouse: Warehouse, landmark: Landmark, 'map-pin': MapPin, briefcase: Briefcase,
}
// Stable, curated order for the Settings icon-picker grid.
export const LOCATION_ICON_NAMES = Object.keys(LOCATION_ICON_MAP)

// Resolve a stored icon slug to its lucide component — unknown/null never crashes,
// it falls back to the same Building2 glyph the read-only hash badge always used.
export function resolveLocationIcon(name?: string | null): LucideIcon {
  return LOCATION_ICON_MAP[(name ?? '').trim().toLowerCase()] ?? Building2
}

// Defaults for a brand-new row's picker — a real, visible swatch/glyph instead of
// an empty string, mirroring the neutral fallback other lookup rows use
// (StatusListEditor's `item.color ?? '#6B7280'`).
export const DEFAULT_LOCATION_ICON = 'building-2'
// eslint-disable-next-line no-restricted-syntax -- DATA: neutral default swatch colour for a brand-new row, not decorative UI chrome
export const DEFAULT_LOCATION_COLOR = '#6B7280'
