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

export default function RadiusMapPanel({ points, center, radiusKm, onCenterChange, onRadiusChange, onPick, pointsLabel, padded = true }: {
  points: MapPoint[]
  center: { lat: number; lng: number }
  radiusKm: number
  onCenterChange: (lat: number, lng: number) => void
  onRadiusChange: (km: number) => void
  onPick: (id: Id) => void
  // Entity-specific "{{count}} … on the map" line; falls back to the generic one.
  pointsLabel?: string
  // Page padding around the panel; off when the host embeds it in a split layout.
  padded?: boolean
}) {
  const { t } = useTranslation('common')

  return (
    <div style={{ padding: padded ? '0 24px 16px' : 0, display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
      {/* Radius: slider + exact km input — both drive the server-side filter. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <label htmlFor="radius-slider" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('map.radius')}</label>
        <input id="radius-slider" type="range" min={5} max={150} step={5} value={radiusKm}
          onChange={e => onRadiusChange(Number(e.target.value))} style={{ width: 180 }} />
        <input type="number" min={1} max={300} value={radiusKm} aria-label={t('map.radius')}
          onChange={e => { const v = Number(e.target.value); if (v >= 1) onRadiusChange(v) }}
          style={{ width: 62, padding: '4px 6px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)',
                   background: 'var(--hover-bg)', color: 'var(--text)', outline: 'none' }} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>km</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('map.clickHint')}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          {pointsLabel ?? t('map.pointCount', { count: points.length })}
        </span>
      </div>
      {/* The map fills the remaining pane height (min keeps it usable on small screens). */}
      <div style={{ flex: 1, minHeight: 380, display: 'flex' }}>
        <div style={{ flex: 1 }}>
          <RadiusMap center={center} radiusKm={radiusKm} points={points} height="100%"
            onCenterChange={onCenterChange} onPickPoint={onPick} />
        </div>
      </div>
    </div>
  )
}
