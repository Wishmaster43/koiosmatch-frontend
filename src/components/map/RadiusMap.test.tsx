/**
 * RadiusMap.test — REWRITTEN in the LEAFLET-WRAPPER lane: the old react-leaflet stub
 * has no meaning any more, so `leaflet` itself is mocked. Covers MAP-Z-1 containment,
 * tiles/prefix, circle + pins, click-to-recentre, pin click not recentring, recentre
 * keeping zoom, and cleanup on unmount.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const h = vi.hoisted(() => {
  const state = {
    mapHandlers: {} as Record<string, (e: unknown) => void>,
    pinHandlers: [] as Array<(e: unknown) => void>,
    setView: undefined as unknown as ReturnType<typeof vi.fn>,
    remove: undefined as unknown as ReturnType<typeof vi.fn>,
    setPrefix: undefined as unknown as ReturnType<typeof vi.fn>,
    tileLayer: undefined as unknown as ReturnType<typeof vi.fn>,
    circle: undefined as unknown as ReturnType<typeof vi.fn>,
    circleMarker: undefined as unknown as ReturnType<typeof vi.fn>,
    stop: undefined as unknown as ReturnType<typeof vi.fn>,
  }
  return state
})

vi.mock('leaflet', () => {
  h.setView = vi.fn(); h.remove = vi.fn(); h.setPrefix = vi.fn(); h.stop = vi.fn()
  h.tileLayer = vi.fn(() => ({ addTo: vi.fn() }))
  h.circle = vi.fn(() => ({}))
  h.circleMarker = vi.fn(() => ({
    bindTooltip: vi.fn(),
    on: vi.fn((_n: string, fn: (e: unknown) => void) => { h.pinHandlers.push(fn) }),
    addTo: vi.fn(),
  }))
  const map = {
    setView: h.setView, getZoom: () => 9, remove: h.remove, addLayer: vi.fn(),
    on: vi.fn((n: string, fn: (e: unknown) => void) => { h.mapHandlers[n] = fn }),
    attributionControl: { setPrefix: h.setPrefix },
  }
  const L = {
    map: vi.fn(() => map), tileLayer: h.tileLayer, circle: h.circle, circleMarker: h.circleMarker,
    layerGroup: vi.fn(() => ({ addTo: vi.fn(), clearLayers: vi.fn(), addLayer: vi.fn() })),
    tooltip: vi.fn(), DomEvent: { stopPropagation: h.stop },
  }
  return { default: L, ...L }
})

import RadiusMap from './RadiusMap'

const C = { lat: 52, lng: 5 }
beforeEach(() => { vi.clearAllMocks(); h.pinHandlers.length = 0 })

describe('RadiusMap', () => {
  it('traps Leaflet in its own stacking context (MAP-Z-1)', () => {
    const { container } = render(<RadiusMap center={C} radiusKm={10} points={[]} height={300} />)
    const w = container.firstElementChild as HTMLElement
    expect(w.style.isolation).toBe('isolate')
    expect(w.style.zIndex).toBe('0')
    expect(w.style.position).toBe('relative')
  })

  it('creates the OSM tile layer and switches the attribution prefix off', () => {
    render(<RadiusMap center={C} radiusKm={10} points={[]} />)
    expect(h.tileLayer.mock.calls[0][0]).toBe('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
    expect(h.setPrefix).toHaveBeenCalledWith(false)
  })

  it('draws the circle at radiusKm * 1000', () => {
    render(<RadiusMap center={C} radiusKm={12} points={[]} />)
    expect(h.circle.mock.calls[0][1]).toMatchObject({ radius: 12000 })
  })

  it('draws one marker per point plus the origin pin when centerMarker is given', () => {
    const pts = [{ id: 'a', lat: 1, lng: 2, label: 'A' }, { id: 'b', lat: 3, lng: 4, label: 'B' }]
    render(<RadiusMap center={C} radiusKm={5} points={pts} centerMarker={{ label: 'Home' }} />)
    expect(h.circleMarker).toHaveBeenCalledTimes(3)
  })

  it('reports a map click as onCenterChange(lat, lng)', () => {
    const onCenterChange = vi.fn()
    render(<RadiusMap center={C} radiusKm={5} points={[]} onCenterChange={onCenterChange} />)
    h.mapHandlers.click({ latlng: { lat: 53, lng: 6 } })
    expect(onCenterChange).toHaveBeenCalledWith(53, 6)
  })

  it('pin click stops propagation and calls onPickPoint only', () => {
    const onPickPoint = vi.fn()
    const onCenterChange = vi.fn()
    render(<RadiusMap center={C} radiusKm={5} points={[{ id: 'p1', lat: 1, lng: 2, label: 'P' }]}
      onPickPoint={onPickPoint} onCenterChange={onCenterChange} />)
    const evt = { originalEvent: {} }
    h.pinHandlers[0](evt)
    expect(h.stop).toHaveBeenCalledWith(evt)
    expect(onPickPoint).toHaveBeenCalledWith('p1')
    expect(onCenterChange).not.toHaveBeenCalled()
  })

  it('pans to a changed center keeping the current zoom', () => {
    const { rerender } = render(<RadiusMap center={C} radiusKm={5} points={[]} />)
    h.setView.mockClear()
    rerender(<RadiusMap center={{ lat: 53, lng: 6 }} radiusKm={5} points={[]} />)
    expect(h.setView).toHaveBeenCalledWith([53, 6], 9)
  })

  it('removes the map on unmount', () => {
    const { unmount } = render(<RadiusMap center={C} radiusKm={5} points={[]} />)
    unmount()
    expect(h.remove).toHaveBeenCalled()
  })
})
