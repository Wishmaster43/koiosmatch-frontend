/**
 * CandidatesMapView — STRAAL-1: the candidates list as a map with a radius search.
 * Thin: maps rows → MapPoints (status colour, city · distance sub) and hands them
 * to the shared RadiusMapPanel; the host page owns centre/radius and the drawer.
 */
import { useTranslation } from 'react-i18next'
import RadiusMapPanel, { type MapPoint } from '@/components/map/RadiusMapPanel'
import { NEUTRAL_AVATAR } from '@/components/ui/Avatar'
import { useLookups } from '@/context/LookupsContext'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

export default function CandidatesMapView({ rows, center, radiusKm, onCenterChange, onRadiusChange, onClearRadius, onPick, padded }: {
  rows: Candidate[]
  center: { lat: number; lng: number }
  radiusKm: number
  onCenterChange: (lat: number, lng: number) => void
  onRadiusChange: (km: number) => void
  // Present while a straal is active — forwards the 'Wis straal' reset.
  onClearRadius?: () => void
  onPick: (id: Id) => void
  padded?: boolean
}) {
  const { t } = useTranslation(['candidates', 'common'])
  const { statusMeta } = useLookups() as unknown as { statusMeta: (v?: string | null) => { color: string } }

  // Only rows with geocoded coordinates land on the map (PDOK fills them on save).
  const points: MapPoint[] = rows
    .filter(c => typeof c.lat === 'number' && typeof c.lng === 'number')
    .map(c => ({
      id: c.id, lat: c.lat as number, lng: c.lng as number, label: c.name,
      sub: [c.city, c.distanceKm != null ? t('common:map.kmAway', { km: c.distanceKm }) : null].filter(Boolean).join(' · '),
      color: c.status ? statusMeta(c.status).color : NEUTRAL_AVATAR,
    }))

  return (
    <RadiusMapPanel points={points} center={center} radiusKm={radiusKm} padded={padded} onClearRadius={onClearRadius}
      onCenterChange={onCenterChange} onRadiusChange={onRadiusChange} onPick={onPick}
      pointsLabel={t('candidates:map.pointCount', { count: points.length })} />
  )
}
