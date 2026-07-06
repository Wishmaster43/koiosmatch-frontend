/**
 * CandidatesMapView — STRAAL-1: the candidates list as a map with a radius search.
 * The host page owns centre/radius (server-side ?lat=&lng=&radius= filtering) and
 * the drawer; this view renders the slider + the shared RadiusMap. Clicking the map
 * moves the search centre; clicking a marker opens that candidate.
 */
import { useTranslation } from 'react-i18next'
import RadiusMap, { type MapPoint } from '@/components/map/RadiusMap'
import { useLookups } from '@/context/LookupsContext'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

export default function CandidatesMapView({ rows, center, radiusKm, onCenterChange, onRadiusChange, onPick }: {
  rows: Candidate[]
  center: { lat: number; lng: number }
  radiusKm: number
  onCenterChange: (lat: number, lng: number) => void
  onRadiusChange: (km: number) => void
  onPick: (id: Id) => void
}) {
  const { t } = useTranslation('candidates')
  const { statusMeta } = useLookups() as unknown as { statusMeta: (v?: string | null) => { color: string } }

  // Only rows with geocoded coordinates land on the map (PDOK fills them on save).
  const points: MapPoint[] = rows
    .filter(c => typeof c.lat === 'number' && typeof c.lng === 'number')
    .map(c => ({
      id: c.id, lat: c.lat as number, lng: c.lng as number, label: c.name,
      sub: [c.city, c.distanceKm != null ? t('map.kmAway', { km: c.distanceKm }) : null].filter(Boolean).join(' · '),
      color: c.status ? statusMeta(c.status).color : '#9CA3AF',
    }))

  return (
    <div style={{ padding: '0 24px 16px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
      {/* Radius slider — drives the server-side filter through the host page. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <label htmlFor="radius-slider" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('map.radius')}</label>
        <input id="radius-slider" type="range" min={5} max={150} step={5} value={radiusKm}
          onChange={e => onRadiusChange(Number(e.target.value))} style={{ width: 220 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', width: 60 }}>{t('map.km', { km: radiusKm })}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('map.clickHint')}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>{t('map.pointCount', { count: points.length })}</span>
      </div>
      <RadiusMap center={center} radiusKm={radiusKm} points={points}
        onCenterChange={onCenterChange} onPickPoint={onPick} />
    </div>
  )
}
