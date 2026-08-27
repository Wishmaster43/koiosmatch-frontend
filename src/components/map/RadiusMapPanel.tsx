/**
 * RadiusMapPanel — the ONE list-as-map surface every entity page mounts (STRAAL-1:
 * candidates, customers, vacancies, …). Renders the radius slider + point count +
 * the shared RadiusMap; the host page owns centre/radius state (server-side
 * ?lat=&lng=&radius= filtering), maps its rows to MapPoints and opens its drawer.
 */
import RadiusControlRow from './RadiusControlRow'
import { tintBg, tintBorder } from '@/lib/tint'
import { Caption } from '@/components/ui/typography'
import { useTranslation } from 'react-i18next'
import RadiusMap, { type MapPoint } from '@/components/map/RadiusMap'
import type { Id } from '@/types/common'

export type { MapPoint }

// Slider domain for the radius control — mirrors the previous native range input
// (min 5, max 150, step 5). The shared Slider has no arbitrary min (always 0), so
// the onChange handler below re-applies the 5km floor to keep the exact same
// reachable value set the native input had.
// Slider domain lives in the shared RadiusControlRow since the 22-08 lift.

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

  return (
    <div style={{ padding: padded ? '0 24px 16px' : 0, display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
      {/* The ONE shared radius row (RadiusControlRow, lifted 22-08). */}
      <RadiusControlRow value={radiusKm} onChange={onRadiusChange}>
        {onClearRadius && (
          <button onClick={onClearRadius}
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- warning-tinted mini-pill (kleurdragende actie zonder Button-tone, r7); tint via lib/tint below
            style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, cursor: 'pointer',
              color: 'var(--color-warning-text)', background: tintBg('var(--color-warning)'),
              border: `1px solid ${tintBorder('var(--color-warning)')}` }}>
            {t('map.clearRadius')}
          </button>
        )}
      </RadiusControlRow>
      {/* FILTER-VLAK-1 (Danny 13-08, rustplan step 3): the click hint used to be
          appended as visible text next to the point count, making this caption
          run long — it now lives in a `title` tooltip on the same short line. */}
      <Caption as="span" title={t('map.clickHint')} style={{ fontStyle: 'italic' }}>
        {pointsLabel ?? t('map.pointCount', { count: points.length })}
      </Caption>
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
