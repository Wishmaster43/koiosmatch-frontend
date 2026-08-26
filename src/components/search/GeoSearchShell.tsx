// GeoSearchShell — GEOSEARCH-1 (Danny 22-08, translated: "the filters serve the
// same purpose, just a different angle" — verbatim: "filters doel is zelfde
// alleen andere invalshoek"): the candidate→vacancy and vacancy→candidate geo
// searches are functional TWINS that had drifted into two different faces —
// labels above the pills vs inside them, a chips row on one side only, radius
// chrome nested two levels deep so an action button could never sit beside it.
// This shell is the ONE layout both now mount: trigger pills, an optional
// active-filter chips row, the radius slider + km input + point count (lifted
// out of RadiusMapPanel so `actions` can share its row), then the map/results split.
import RadiusControlRow from '@/components/map/RadiusControlRow'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
// HUISSTIJL-1: the shared muted-caption atom (identity-only swap for the point-count line).
import { Caption } from '@/components/ui/typography'

export interface GeoSearchRadius {
  value: number
  onChange: (km: number) => void
  countLabel: string
}

interface GeoSearchShellProps {
  // The fixed trigger-pill row — laid out in ONE inline flex row, never
  // captions above (that drift is exactly what this shell retires).
  triggers: ReactNode
  // Active-filter chips row; omitted (or null) renders no row at all — no
  // empty wrapper, no stray gap.
  chips?: ReactNode
  // Absent while the host has no origin coordinates (mirrors GEO-DEGRADE-1):
  // the radius chrome only makes sense once there is something to measure from.
  radius?: GeoSearchRadius
  // e.g. the "Koios-advies verversen" button — right-aligned beside the radius
  // controls; still renders (right-aligned alone) when `radius` is absent, so a
  // geocode-missing host never silently loses the action.
  actions?: ReactNode
  mapHeight?: number | string
  map: ReactNode
  results: ReactNode
}

// The one shared layout for both geo-search directions: trigger pills, an
// optional chips row, the radius/actions row, then the map/results split.
export default function GeoSearchShell({ triggers, chips, radius, actions, mapHeight, map, results }: GeoSearchShellProps) {
  const { t } = useTranslation('common')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div>{triggers}</div>
        {chips}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {/* Map pane — wider (flex 1.4), the primary spatial view. */}
        <div style={{ flex: '1.4 1 360px', minWidth: 360, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(radius || actions) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* The ONE shared radius row (RadiusControlRow, lifted 22-08). */}
              {radius && <RadiusControlRow value={radius.value} onChange={radius.onChange} />}
              {/* Right-aligned regardless of whether the radius block rendered — a
                  geocode-missing host must never lose this action too (GEO-DEGRADE-1). */}
              {actions && <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>{actions}</div>}
            </div>
          )}
          {radius && (
            <Caption title={t('map.clickHint')} style={{ fontStyle: 'italic' }}>
              {radius.countLabel}
            </Caption>
          )}
          {/* The map fills the remaining pane height; hosts force a taller map via mapHeight. */}
          <div style={{ flex: 1, minHeight: mapHeight ?? 380, display: 'flex' }}>
            <div style={{ flex: 1 }}>{map}</div>
          </div>
        </div>
        {/* List pane — narrower, own scroll so a long result list never grows the drawer. */}
        <div style={{ flex: '1 1 300px', minWidth: 300, maxHeight: 520, overflowY: 'auto' }}>{results}</div>
      </div>
    </div>
  )
}
