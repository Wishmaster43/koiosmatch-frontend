/**
 * VacanciesMapView — STRAAL-1: the vacancies list as a map with a radius search.
 * Thin: maps rows → MapPoints (status colour, city · distance sub) and hands them
 * to the shared RadiusMapPanel; the host page owns centre/radius and the drawer.
 */
import { useTranslation } from 'react-i18next'
import RadiusMapPanel, { type MapPoint } from '@/components/map/RadiusMapPanel'
import type { Vacancy } from '@/types/vacancy'
import type { Id } from '@/types/common'

export default function VacanciesMapView({ rows, center, radiusKm, onCenterChange, onRadiusChange, onClearRadius, onPick, padded }: {
  rows: Vacancy[]
  center: { lat: number; lng: number }
  radiusKm: number
  onCenterChange: (lat: number, lng: number) => void
  onRadiusChange: (km: number) => void
  // Present while a straal is active — forwards the 'Wis straal' reset.
  onClearRadius?: () => void
  onPick: (id: Id) => void
  // Off when the host embeds the panel in the split (map | table) layout.
  padded?: boolean
}) {
  const { t } = useTranslation(['vacancies', 'common'])

  // Only rows with geocoded coordinates land on the map (PDOK fills them on save).
  const points: MapPoint[] = rows
    .filter(v => typeof v.lat === 'number' && typeof v.lng === 'number' && v.id != null)
    .map(v => ({
      id: v.id as Id, lat: v.lat as number, lng: v.lng as number, label: v.title,
      sub: [v.city, v.distanceKm != null ? t('common:map.kmAway', { km: v.distanceKm }) : null].filter(Boolean).join(' · '),
      // eslint-disable-next-line no-restricted-syntax -- DATA fallback marker colour, not a UI colour choice (mirrors Avatar.tsx's identical constant)
      color: v.statusColor || '#9CA3AF',
    }))

  return (
    <RadiusMapPanel points={points} center={center} radiusKm={radiusKm} padded={padded} onClearRadius={onClearRadius}
      onCenterChange={onCenterChange} onRadiusChange={onRadiusChange} onPick={onPick}
      pointsLabel={t('vacancies:map.pointCount', { count: points.length })} />
  )
}
