/**
 * RadiusMap — the ONE map component for every radius view (STRAAL-1: candidates,
 * customers, vacancies, branches). A thin wrapper over Leaflet itself + OSM tiles
 * (free, no key). Renders the search circle, one CircleMarker per point (no icon
 * assets — token colours instead) and lets the user re-centre by clicking the map.
 * Presentational: the host owns centre/radius state and does the radius filtering.
 */
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './radiusMap.css'
import type { Id } from '@/types/common'

export interface MapPoint { id: Id; lat: number; lng: number; label: string; sub?: string; color?: string }

// Builds tooltip content from TEXT nodes (never an HTML string), so labels cannot inject markup (§7).
function tooltipContent(label: string, sub?: string): HTMLElement {
  const box = document.createElement('div')
  const strong = document.createElement('strong')
  strong.textContent = label
  box.appendChild(strong)
  if (sub) {
    box.appendChild(document.createElement('br'))
    box.appendChild(document.createTextNode(sub))
  }
  return box
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
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const onCenterRef = useRef(onCenterChange)
  const onPickRef = useRef(onPickPoint)
  const initialCenter = useRef(center)
  const hasPick = !!onPickPoint

  // Keep the latest callbacks in refs so the map's click handlers never go stale.
  useEffect(() => { onCenterRef.current = onCenterChange; onPickRef.current = onPickPoint })

  // Mount: create the map, OSM tiles, click-to-recentre and the shared layer group.
  useEffect(() => {
    if (!elRef.current) return undefined
    const map = L.map(elRef.current, { center: [initialCenter.current.lat, initialCenter.current.lng], zoom: 9 })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    // Danny 08-09: drop Leaflet's own prefix; the OSM credit stays (ODbL tile licence).
    map.attributionControl?.setPrefix(false)
    map.on('click', (e: L.LeafletMouseEvent) => onCenterRef.current?.(e.latlng.lat, e.latlng.lng))
    const layer = L.layerGroup()
    layer.addTo(map)
    mapRef.current = map
    layerRef.current = layer
    return () => { map.remove(); mapRef.current = null; layerRef.current = null }
  }, [])

  // Host-driven recentre keeps the current zoom, so it never resets how far the user zoomed in.
  useEffect(() => { mapRef.current?.setView([center.lat, center.lng], mapRef.current.getZoom()) }, [center.lat, center.lng])

  // Redraw the radius circle, origin pin and result pins whenever their inputs change.
  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    layer.clearLayers()
    const origin: L.LatLngExpression = [center.lat, center.lng]
    // The search radius around the chosen centre — the fixed, tenant-invariant map token (§4).
    layer.addLayer(L.circle(origin, { radius: radiusKm * 1000, color: 'var(--color-map)', fillColor: 'var(--color-map)', fillOpacity: 0.08, weight: 1.5 }))
    // Origin pin — bigger, primary-filled, so it reads apart from result pins.
    if (centerMarker) {
      const pin = L.circleMarker(origin, { radius: 10, color: '#fff', weight: 2.5, fillColor: 'var(--color-primary)', fillOpacity: 1 })
      pin.bindTooltip(tooltipContent(centerMarker.label, centerMarker.sub), { direction: 'top', offset: [0, -8] })
      layer.addLayer(pin)
    }
    points.forEach(p => {
      const pin = L.circleMarker([p.lat, p.lng], { radius: 7, color: '#fff', weight: 1.5, fillColor: p.color ?? 'var(--color-map)', fillOpacity: 0.95 })
      pin.bindTooltip(tooltipContent(p.label, p.sub), { direction: 'top', offset: [0, -6] })
      // Vector layers bubble clicks to the map, so stop it: opening a result must not move the search origin.
      if (onPickRef.current) pin.on('click', (e: L.LeafletMouseEvent) => { L.DomEvent.stopPropagation(e); onPickRef.current?.(p.id) })
      layer.addLayer(pin)
    })
  }, [center.lat, center.lng, radiusKm, points, centerMarker, hasPick])

  // MAP-Z-1 (Danny 13-08): isolation traps Leaflet's high-z panes inside this box so any modal above always wins.
  return (
    <div style={{ height, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)',
      position: 'relative', zIndex: 0, isolation: 'isolate' }}>
      <div ref={elRef} style={{ height: '100%', width: '100%' }} />
    </div>
  )
}
