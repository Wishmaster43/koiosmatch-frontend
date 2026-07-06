/**
 * CustomersMapView — STRAAL-1: the customers list as a map with a radius search.
 * Thin: maps rows → MapPoints (status colour, city · distance sub) and hands them
 * to the shared RadiusMapPanel; the host page owns centre/radius and the drawer.
 */
import { useTranslation } from 'react-i18next'
import RadiusMapPanel, { type MapPoint } from '@/components/map/RadiusMapPanel'
import type { Customer } from '@/types/customer'
import type { Id } from '@/types/common'

export default function CustomersMapView({ rows, statusColor, center, radiusKm, onCenterChange, onRadiusChange, onPick }: {
  rows: Customer[]
  // Status → colour resolver from the page's lookup (stable per render is fine here).
  statusColor: (v: Customer['status']) => string | undefined
  center: { lat: number; lng: number }
  radiusKm: number
  onCenterChange: (lat: number, lng: number) => void
  onRadiusChange: (km: number) => void
  onPick: (id: Id) => void
}) {
  const { t } = useTranslation(['customers', 'common'])

  // Only rows with geocoded coordinates land on the map (PDOK fills them on save).
  const points: MapPoint[] = rows
    .filter(c => typeof c.lat === 'number' && typeof c.lng === 'number' && c.id != null)
    .map(c => ({
      id: c.id as Id, lat: c.lat as number, lng: c.lng as number, label: c.name,
      sub: [c.city, c.distanceKm != null ? t('common:map.kmAway', { km: c.distanceKm }) : null].filter(Boolean).join(' · '),
      color: statusColor(c.status) ?? '#9CA3AF',
    }))

  return (
    <RadiusMapPanel points={points} center={center} radiusKm={radiusKm}
      onCenterChange={onCenterChange} onRadiusChange={onRadiusChange} onPick={onPick}
      pointsLabel={t('customers:map.pointCount', { count: points.length })} />
  )
}
