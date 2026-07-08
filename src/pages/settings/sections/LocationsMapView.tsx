/**
 * LocationsMapView — STRAAL-1 for VESTIGINGEN: the tenant's own office network on
 * the shared radius map. The settings section already holds all rows, so the radius
 * filter runs locally (haversine) — no extra server round-trips. Thin: maps rows →
 * MapPoints and hands them to the shared RadiusMapPanel (never duplicated map code).
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import RadiusMapPanel, { type MapPoint } from '@/components/map/RadiusMapPanel'
import type { Id } from '@/types/common'

// Minimal row shape — the settings section passes raw API rows (host file is .jsx).
interface LocationRow { id?: Id; name?: string; city?: string; lat?: number | null; lng?: number | null }

// Great-circle distance in km (haversine) — plenty precise for an office radius.
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

export default function LocationsMapView({ locations }: { locations: LocationRow[] }) {
  const { t } = useTranslation('settings')

  // All geocoded offices as map points (the backend fills lat/lng once an address is saved).
  const allPoints: MapPoint[] = useMemo(() => locations
    .filter(l => typeof l.lat === 'number' && typeof l.lng === 'number' && l.id != null)
    .map(l => ({ id: l.id as Id, lat: l.lat as number, lng: l.lng as number, label: l.name || '—', sub: l.city || undefined })),
  [locations])

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
