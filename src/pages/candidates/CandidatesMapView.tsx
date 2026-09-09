/**
 * CandidatesMapView — STRAAL-1: the candidates list as a map with a radius search.
 * Thin: maps rows → MapPoints (status colour, city · distance sub) and hands them
 * to the shared RadiusMapPanel; the host page owns centre/radius and the drawer.
 */
import { useTranslation } from 'react-i18next'
import PendingGeocodeBanner from '@/components/map/PendingGeocodeBanner'
import RadiusMapPanel, { type MapPoint } from '@/components/map/RadiusMapPanel'
import { NEUTRAL_AVATAR } from '@/components/ui/Avatar'
import { useLookups } from '@/context/LookupsContext'
import { countPendingGeocode, toCoord } from '@/lib/coords'
import type { Candidate } from '@/types/candidate'
import type { MapViewProps } from '@/components/ui/mapTypes'

// Thin adapter from candidate rows to MapPoints for the shared RadiusMapPanel,
export default function CandidatesMapView({ rows, center, radiusKm, onCenterChange, onRadiusChange, onClearRadius, onPick, padded }: MapViewProps<Candidate>) {
  const { t } = useTranslation(['candidates', 'common'])
  const { statusMeta } = useLookups() as unknown as { statusMeta: (v?: string | null) => { color: string } }

  // Only rows with geocoded coordinates land on the map (PDOK fills them on save).
  // PDOK-LATLNG-1 (§10): Laravel serialises DECIMAL columns as JSON strings, so a
  // `typeof === 'number'` check silently drops real coordinates — toCoord coerces
  // both number and numeric-string, mirroring CustomersMapView.
  const points: MapPoint[] = rows
    .map(c => ({ c, lat: toCoord(c.lat), lng: toCoord(c.lng) }))
    .filter(({ lat, lng }) => lat != null && lng != null)
    .map(({ c, lat, lng }) => ({
      id: c.id, lat: lat as number, lng: lng as number, label: c.name,
      sub: [c.city, c.distanceKm != null ? t('common:map.kmAway', { km: c.distanceKm }) : null].filter(Boolean).join(' · '),
      color: c.status ? statusMeta(c.status).color : NEUTRAL_AVATAR,
    }))

  // PENDING-GEOCODE-1: rows with an address but no coordinates yet — the queue
  // fills them in automatically; address-less rows are a different problem.
  const pending = countPendingGeocode(rows)

  return (
    <>
      <PendingGeocodeBanner count={pending} padded={padded} label={t('candidates:map.pendingGeocode', { count: pending })} />
      <RadiusMapPanel points={points} center={center} radiusKm={radiusKm} padded={padded} onClearRadius={onClearRadius}
        onCenterChange={onCenterChange} onRadiusChange={onRadiusChange} onPick={onPick}
        pointsLabel={t('candidates:map.pointCount', { count: points.length })} />
    </>
  )
}
