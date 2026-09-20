/**
 * RadiusMap — the ONE map component for every radius view (STRAAL-1: candidates,
 * customers, vacancies, branches). Leaflet + OSM tiles (free, no key). Renders the
 * search circle, one CircleMarker per point (no icon assets — token colours instead)
 * and lets the user re-centre by clicking the map. Presentational: the host owns
 * centre/radius state and does the (server-side) radius filtering.
 */
import { useEffect } from 'react'
import { MapContainer, TileLayer, Circle, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { DomEvent } from 'leaflet'
import type { LeafletMouseEvent } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './radiusMap.css'
import type { Id } from '@/types/common'

export interface MapPoint { id: Id; lat: number; lng: number; label: string; sub?: string; color?: string }

// Danny 08-09: drop Leaflet's own "Leaflet" prefix (and its flag) from the corner;
// the OpenStreetMap credit stays because the ODbL tile licence requires it on-map.
function AttributionPrefixOff() {
  const map = useMap()
  useEffect(() => { map.attributionControl?.setPrefix(false) }, [map])
  return null
}

// Click-to-recentre helper (hooks must live inside MapContainer).
function ClickToCenter({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onPick?.(e.latlng.lat, e.latlng.lng) })
  return null
}

// react-leaflet only applies MapContainer's `center` prop once, at map creation
// (react-leaflet's own MapContainerComponent calls map.setView only inside its
// creation effect) — a later host-driven recentre (e.g. a PDOK geocode result
// via useApplyGeoFilter) would otherwise leave the viewport behind while the
// circle/pins already moved. Keeps the current zoom so a recentre never resets
// how far the user zoomed in.
function RecenterOnChange({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lng], map.getZoom()) }, [lat, lng, map])
  return null
}

// Purely presentational Leaflet map (see the module doc above): renders the search circle + result points, and reports a re-centre click back up rather than owning any filter state itself.
export default function RadiusMap({ center, radiusKm, points, onCenterChange, onPickPoint, height = 520, centerMarker }: {
  center: { lat: number; lng: number }
  radiusKm: number
  points: MapPoint[]
  onCenterChange?: (lat: number, lng: number) => void
  onPickPoint?: (id: Id) => void
  height?: number | string
  // Optional distinct ORIGIN pin (Danny 23-07: candidate home / vacancy location
  // must be visible next to the result pins) — absent on plain list-as-map pages.
  centerMarker?: { label: string; sub?: string }
}) {
  // MAP-Z-1 (Danny 13-08, screenshot: 'kaart gaat over solliciteren-popup heen'):
  // Leaflet's internal panes carry z-indexes up to ~1000, which punch through any
  // overlay whose z sits below that. isolation creates a stacking context of its
  // own at z 0, trapping every Leaflet layer INSIDE this box — so any modal or
  // popover above it always wins, on all nine map surfaces at once.
  return (
    <div style={{ height, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)',
      position: 'relative', zIndex: 0, isolation: 'isolate' }}>
      <MapContainer center={[center.lat, center.lng]} zoom={9} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <AttributionPrefixOff />
        <RecenterOnChange lat={center.lat} lng={center.lng} />
        <ClickToCenter onPick={onCenterChange} />
        {/* The search radius around the chosen centre — the fixed, tenant-invariant map token (§4). */}
        <Circle center={[center.lat, center.lng]} radius={radiusKm * 1000}
          pathOptions={{ color: 'var(--color-map)', fillColor: 'var(--color-map)', fillOpacity: 0.08, weight: 1.5 }} />
        {/* Origin pin — bigger, primary-filled, so it reads apart from result pins. */}
        {centerMarker && (
          <CircleMarker center={[center.lat, center.lng]} radius={10}
            pathOptions={{ color: '#fff', weight: 2.5, fillColor: 'var(--color-primary)', fillOpacity: 1 }}>
            <Tooltip direction="top" offset={[0, -8]}>
              <strong>{centerMarker.label}</strong>{centerMarker.sub ? <><br />{centerMarker.sub}</> : null}
            </Tooltip>
          </CircleMarker>
        )}
        {points.map(p => (
          <CircleMarker key={String(p.id)} center={[p.lat, p.lng]} radius={7}
            // Leaflet's vector layers bubble mouse events to the map by default
            // (bubblingMouseEvents), so an un-stopped pin click also fires the
            // map's own click-to-recentre handler above — opening a result would
            // silently move the search origin too. Stop it explicitly.
            eventHandlers={onPickPoint ? { click: (e: LeafletMouseEvent) => { DomEvent.stopPropagation(e); onPickPoint(p.id) } } : undefined}
            pathOptions={{ color: '#fff', weight: 1.5, fillColor: p.color ?? 'var(--color-map)', fillOpacity: 0.95 }}>
            <Tooltip direction="top" offset={[0, -6]}>
              <strong>{p.label}</strong>{p.sub ? <><br />{p.sub}</> : null}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
