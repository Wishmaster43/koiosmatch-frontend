/**
 * LocationsMapView — STRAAL-1 for VESTIGINGEN: the tenant's own office network on
 * the shared radius map. The settings section already holds all rows, so the radius
 * filter runs locally (haversine) — no extra server round-trips. Thin: maps rows →
 * MapPoints and hands them to the shared RadiusMapPanel (never duplicated map code).
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import RadiusMapPanel, { type MapPoint } from '@/components/map/RadiusMapPanel'
import { toCoord } from '@/lib/coords'
import type { Id } from '@/types/common'

// Minimal row shape — the settings section passes raw API rows (host file is .jsx)
// lat/lng are deliberately `unknown`: the API sends DECIMALs as STRINGS, so typing
// them as number would be a lie the compiler then helps enforce (§10). toCoord below
// is the one place that coerces them.
interface LocationRow { id?: Id; name?: string; city?: string; lat?: unknown; lng?: unknown }

// Great-circle distance in km (haversine) — plenty precise for an office radius.
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

// Radius map of the tenant's own office network; already-loaded rows are filtered locally (haversine), so no extra server round-trip is needed (see file header).
export default function LocationsMapView({ locations }: { locations: LocationRow[] }) {
  const { t } = useTranslation('settings')

  // All geocoded offices as map points (the backend fills lat/lng once an address is
  // saved). Coordinates go through toCoord, never `typeof x === 'number'`: this host
  // passes RAW API rows and Laravel serialises DECIMAL columns as STRINGS, so the
  // strict check silently dropped every geocoded office and left the map empty
  // (same class as PDOK-LATLNG-1, §10 — the mappers were fixed, this view was missed).
  const allPoints: MapPoint[] = useMemo(() => locations.flatMap(l => {
    const lat = toCoord(l.lat), lng = toCoord(l.lng)
    return lat !== null && lng !== null && l.id != null
      ? [{ id: l.id as Id, lat, lng, label: l.name || '—', sub: l.city || undefined }]
      : []
  }), [locations])

  // Centre starts on the middle of the network (NL centroid fallback) with a wide
  // radius, so the whole office network is visible before the user narrows the search.
  const [center, setCenter] = useState(() => allPoints.length
    ? { lat: allPoints.reduce((s, p) => s + p.lat, 0) / allPoints.length, lng: allPoints.reduce((s, p) => s + p.lng, 0) / allPoints.length }
    : { lat: 52.13, lng: 5.29 })
  const [radiusKm, setRadiusKm] = useState(150)

  // Local radius filter — the circle drawn on the map always tells the truth.
  const points = useMemo(() => allPoints.filter(p => distanceKm(center, p) <= radiusKm), [allPoints, center, radiusKm])

  // Honest empty note: no geocoded rows yet (either no locations, or none with an address).
  if (allPoints.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px 0' }}>
        {t('locations.mapNoCoords')}
      </p>
    )
  }

  return (
    // Fixed panel height so the flex-filling map gets room inside the settings column.
    <div style={{ display: 'flex', flexDirection: 'column', height: 520 }}>
      <RadiusMapPanel points={points} center={center} radiusKm={radiusKm} padded={false}
        onCenterChange={(lat, lng) => setCenter({ lat, lng })} onRadiusChange={setRadiusKm}
        onPick={() => { /* settings has no drawer to open — tooltip carries the info */ }} />
    </div>
  )
}
