/**
 * RadiusMapPanel — the ONE list-as-map surface every entity page mounts (STRAAL-1:
 * candidates, customers, vacancies, …). Renders the radius slider + point count +
 * the shared RadiusMap; the host page owns centre/radius state (server-side
 * ?lat=&lng=&radius= filtering), maps its rows to MapPoints and opens its drawer.
 */
import { useTranslation } from 'react-i18next'
import RadiusMap, { type MapPoint } from '@/components/map/RadiusMap'
import type { Id } from '@/types/common'

export type { MapPoint }

export default function RadiusMapPanel({ points, center, radiusKm, onCenterChange, onRadiusChange, onPick, pointsLabel }: {
  points: MapPoint[]
  center: { lat: number; lng: number }
  radiusKm: number
  onCenterChange: (lat: number, lng: number) => void
  onRadiusChange: (km: number) => void
  onPick: (id: Id) => void
  // Entity-specific "{{count}} … on the map" line; falls back to the generic one.
  pointsLabel?: string
}) {
  const { t } = useTranslation('common')

  return (
    <div style={{ padding: '0 24px 16px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
      {/* Radius slider — drives the server-side filter through the host page. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <label htmlFor="radius-slider" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('map.radius')}</label>
        <input id="radius-slider" type="range" min={5} max={150} step={5} value={radiusKm}
          onChange={e => onRadiusChange(Number(e.target.value))} style={{ width: 220 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', width: 60 }}>{t('map.km', { km: radiusKm })}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('map.clickHint')}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          {pointsLabel ?? t('map.pointCount', { count: points.length })}
        </span>
      </div>
      <RadiusMap center={center} radiusKm={radiusKm} points={points}
        onCenterChange={onCenterChange} onPickPoint={onPick} />
    </div>
  )
}
