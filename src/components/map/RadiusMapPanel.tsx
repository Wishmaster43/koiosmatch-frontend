/**
 * RadiusMapPanel — the ONE list-as-map surface every entity page mounts (STRAAL-1:
 * candidates, customers, vacancies, …). Renders the radius slider + point count +
 * the shared RadiusMap; the host page owns centre/radius state (server-side
 * ?lat=&lng=&radius= filtering), maps its rows to MapPoints and opens its drawer.
 */
import { useTranslation } from 'react-i18next'
import RadiusMap, { type MapPoint } from '@/components/map/RadiusMap'
import Slider from '@/components/ui/Slider'
import type { Id } from '@/types/common'

export type { MapPoint }

// Slider domain for the radius control — mirrors the previous native range input
// (min 5, max 150, step 5). The shared Slider has no arbitrary min (always 0), so
// the onChange handler below re-applies the 5km floor to keep the exact same
// reachable value set the native input had.
const RADIUS_SLIDER_MAX = 150
const RADIUS_SLIDER_MIN = 5
const RADIUS_SLIDER_STEP = 5

export default function RadiusMapPanel({ points, center, radiusKm, onCenterChange, onRadiusChange, onClearRadius, onPick, pointsLabel, padded = true, mapHeight, centerMarker }: {
  points: MapPoint[]
  center: { lat: number; lng: number }
  // 0 = straal inactive: show ALL points, no circle (the silent default-radius
  // hid everything outside 30km-Utrecht — Danny 14/7).
  radiusKm: number
  onCenterChange: (lat: number, lng: number) => void
  onRadiusChange: (km: number) => void
  // Present while a straal is active — renders the 'Wis straal' reset button.
  onClearRadius?: () => void
  onPick: (id: Id) => void
  // Entity-specific "{{count}} … on the map" line; falls back to the generic one.
  pointsLabel?: string
  // Page padding around the panel; off when the host embeds it in a split layout.
  padded?: boolean
  // Forwarded to RadiusMap: taller map in the drawer tabs + the distinct origin pin.
  mapHeight?: number | string
  centerMarker?: { label: string; sub?: string }
}) {
  const { t } = useTranslation('common')

  // Clamp back onto the 5km floor — see RADIUS_SLIDER_MIN doc comment above.
  const handleSliderChange = (v: number) => onRadiusChange(Math.max(RADIUS_SLIDER_MIN, v))

  return (
    <div style={{ padding: padded ? '0 24px 16px' : 0, display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
      {/* Radius: the ONE shared orange Slider (COMPACT-1, Danny 09-08 — was a bare
          <input type="range"> rendering in the browser's own blue, a second slider
          look right below the "Uren per week" filter's shared Slider) + exact km
          input, both driving the server-side filter. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{t('map.radius')}</span>
        <div style={{ width: 110, flexShrink: 0 }}>
          <Slider value={radiusKm > 0 ? radiusKm : 30} max={RADIUS_SLIDER_MAX} step={RADIUS_SLIDER_STEP}
            onChange={handleSliderChange} ariaLabel={t('map.radius')} />
        </div>
        <input type="number" min={1} max={300} value={radiusKm > 0 ? radiusKm : ''} placeholder="—" aria-label={t('map.radius')}
          onChange={e => { const v = Number(e.target.value); if (v >= 1) onRadiusChange(v) }}
          style={{ width: 56, padding: '4px 6px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)',
                   background: 'var(--hover-bg)', color: 'var(--text)', outline: 'none' }} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>km</span>
        {onClearRadius && (
          <button onClick={onClearRadius}
            style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, cursor: 'pointer',
              color: 'var(--color-warning)', background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)' }}>
            {t('map.clearRadius')}
          </button>
        )}
      </div>
      {/* FILTER-VLAK-1 (Danny 13-08, rustplan step 3): the click hint used to be
          appended as visible text next to the point count, making this caption
          run long — it now lives in a `title` tooltip on the same short line. */}
      <span title={t('map.clickHint')} style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
        {pointsLabel ?? t('map.pointCount', { count: points.length })}
      </span>
      {/* The map fills the remaining pane height; hosts (drawer tabs) can force a
          taller map via mapHeight (Danny 23-07: "kaart kan langer"). */}
      <div style={{ flex: 1, minHeight: mapHeight ?? 380, display: 'flex' }}>
        <div style={{ flex: 1 }}>
          <RadiusMap center={center} radiusKm={radiusKm} points={points} height="100%"
            onCenterChange={onCenterChange} onPickPoint={onPick} centerMarker={centerMarker} />
        </div>
      </div>
    </div>
  )
}
