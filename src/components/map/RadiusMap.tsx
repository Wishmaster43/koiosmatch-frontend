/**
 * RadiusMap — the ONE map component for every radius view (STRAAL-1: candidates,
 * customers, vacancies, branches). Leaflet + OSM tiles (free, no key). Renders the
 * search circle, one CircleMarker per point (no icon assets — token colours instead)
 * and lets the user re-centre by clicking the map. Presentational: the host owns
 * centre/radius state and does the (server-side) radius filtering.
 */
import { MapContainer, TileLayer, Circle, CircleMarker, Tooltip, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Id } from '@/types/common'

export interface MapPoint { id: Id; lat: number; lng: number; label: string; sub?: string; color?: string }

// Click-to-recentre helper (hooks must live inside MapContainer).
function ClickToCenter({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onPick?.(e.latlng.lat, e.latlng.lng) })
  return null
}

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
  return (
    <div style={{ height, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <MapContainer center={[center.lat, center.lng]} zoom={9} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
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
            eventHandlers={onPickPoint ? { click: () => onPickPoint(p.id) } : undefined}
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
