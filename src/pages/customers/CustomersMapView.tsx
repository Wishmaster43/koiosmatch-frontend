/**
 * CustomersMapView — STRAAL-1: the customers list as a map with a radius search.
 * Thin: maps rows → MapPoints (status colour, city · distance sub) and hands them
 * to the shared RadiusMapPanel; the host page owns centre/radius and the drawer.
 */
import { useTranslation } from 'react-i18next'
import RadiusMapPanel, { type MapPoint } from '@/components/map/RadiusMapPanel'
import { toCoord } from '@/lib/coords'
import type { Customer } from '@/types/customer'
import type { Id } from '@/types/common'

export default function CustomersMapView({ rows, statusColor, center, radiusKm, onCenterChange, onRadiusChange, onPick, padded }: {
  rows: Customer[]
  // Status → colour resolver from the page's lookup (stable per render is fine here).
  statusColor: (v: Customer['status']) => string | undefined
  center: { lat: number; lng: number }
  radiusKm: number
  onCenterChange: (lat: number, lng: number) => void
  onRadiusChange: (km: number) => void
  onPick: (id: Id) => void
  // Off when the host embeds the panel in the split (map | table) layout.
  padded?: boolean
}) {
  const { t } = useTranslation(['customers', 'common'])

  // Only rows with geocoded coordinates land on the map (PDOK fills them on save).
  // PDOK-LATLNG-1 (§10, bit again 14-08 "alle klanten zijn weg"): Laravel serialises
  // DECIMAL columns as STRINGS — a `typeof === 'number'` check drops every real
  // coordinate the moment the resource stops float-casting. toCoord coerces both.
  const points: MapPoint[] = rows
    .map(c => ({ c, lat: toCoord(c.lat), lng: toCoord(c.lng) }))
    .filter(({ c, lat, lng }) => lat != null && lng != null && c.id != null)
    .map(({ c, lat, lng }) => ({
      id: c.id as Id, lat: lat as number, lng: lng as number, label: c.name,
      sub: [c.city, c.distanceKm != null ? t('common:map.kmAway', { km: c.distanceKm }) : null].filter(Boolean).join(' · '),
      // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
      color: statusColor(c.status) ?? '#9CA3AF',
    }))

  return (
    <RadiusMapPanel points={points} center={center} radiusKm={radiusKm} padded={padded}
      onCenterChange={onCenterChange} onRadiusChange={onRadiusChange} onPick={onPick}
      pointsLabel={t('customers:map.pointCount', { count: points.length })} />
  )
}
