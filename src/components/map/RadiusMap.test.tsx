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
    bindTooltip: undefined as unknown as ReturnType<typeof vi.fn>,
    clearLayers: undefined as unknown as ReturnType<typeof vi.fn>,
  }
  return state
})

vi.mock('leaflet', () => {
  h.setView = vi.fn(); h.remove = vi.fn(); h.setPrefix = vi.fn(); h.stop = vi.fn(); h.bindTooltip = vi.fn(); h.clearLayers = vi.fn()
  h.tileLayer = vi.fn(() => ({ addTo: vi.fn() }))
  h.circle = vi.fn(() => ({}))
  h.circleMarker = vi.fn(() => ({
    bindTooltip: h.bindTooltip,
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
    layerGroup: vi.fn(() => ({ addTo: vi.fn(), clearLayers: h.clearLayers, addLayer: vi.fn() })),
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

  it('takes the tile URL and attribution from lib/mapTiles', async () => {
    const { mapTiles } = await import('@/lib/mapTiles')
    render(<RadiusMap center={C} radiusKm={10} points={[]} />)
    expect(h.tileLayer).toHaveBeenCalledWith(mapTiles.url, { attribution: mapTiles.attribution })
  })

  it('rings pins with the theme-invariant token, never a raw hex', () => {
    render(<RadiusMap center={C} radiusKm={10} centerMarker={{ label: 'o' }} points={[{ id: 1, lat: 1, lng: 2, label: 'a' }]} />)
    expect(h.circleMarker).toHaveBeenCalledTimes(2)
    for (const call of h.circleMarker.mock.calls) {
      expect(call[1].color).toBe('var(--color-map-pin-ring)')
      expect(JSON.stringify(call[1])).not.toMatch(/#[0-9a-f]{3,6}/i)
    }
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

  // §7: tooltip content is built from text nodes, so a hostile label can never inject markup.
  it('builds tooltips from text nodes only (XSS-safe), for pins and the origin marker', () => {
    const evil = '<img src=x onerror=alert(1)>'
    render(<RadiusMap center={C} radiusKm={5} centerMarker={{ label: evil }} points={[{ id: 1, lat: 1, lng: 2, label: evil }]} />)
    expect(h.bindTooltip).toHaveBeenCalledTimes(2)
    for (const call of h.bindTooltip.mock.calls) {
      const el = call[0] as HTMLElement
      expect(el).toBeInstanceOf(HTMLElement)
      expect(el.querySelector('img')).toBeNull()
      expect(el.querySelector('br')).toBeNull()
      expect(el.textContent).toBe(evil)
    }
  })

  it('adds exactly one line break and the sub text when a sub is given', () => {
    render(<RadiusMap center={C} radiusKm={5} points={[{ id: 1, lat: 1, lng: 2, label: 'A', sub: 'Utrecht' }]} />)
    const el = h.bindTooltip.mock.calls[0][0] as HTMLElement
    expect(el.querySelectorAll('br')).toHaveLength(1)
    expect(el.textContent).toContain('Utrecht')
  })

  it('redraws on a new points array but not on an unrelated prop change', () => {
    const pts = [{ id: 'a', lat: 1, lng: 2, label: 'A' }]
    const marker = { label: 'Home' }
    const { rerender } = render(<RadiusMap center={C} radiusKm={5} points={pts} centerMarker={marker} height={300} />)
    h.clearLayers.mockClear(); h.circle.mockClear()
    rerender(<RadiusMap center={C} radiusKm={5} points={pts} centerMarker={marker} height={400} />)
    expect(h.clearLayers).not.toHaveBeenCalled()
    expect(h.circle).not.toHaveBeenCalled()
    rerender(<RadiusMap center={C} radiusKm={5} points={[{ ...pts[0] }]} centerMarker={marker} height={400} />)
    expect(h.clearLayers).toHaveBeenCalledTimes(1)
    expect(h.circle).toHaveBeenCalledTimes(1)
  })

  it('redraws circle and pins when radius and points change', () => {
    const { rerender } = render(<RadiusMap center={C} radiusKm={5} points={[{ id: 'a', lat: 1, lng: 2, label: 'A' }]} />)
    h.clearLayers.mockClear(); h.circle.mockClear(); h.circleMarker.mockClear()
    rerender(<RadiusMap center={C} radiusKm={8} points={[{ id: 'a', lat: 1, lng: 2, label: 'A' }, { id: 'b', lat: 3, lng: 4, label: 'B' }]} />)
    expect(h.clearLayers).toHaveBeenCalledTimes(1)
    expect(h.circle.mock.calls[0][1]).toMatchObject({ radius: 8000 })
    expect(h.circleMarker).toHaveBeenCalledTimes(2)
  })

  it('calls the latest onPickPoint and onCenterChange without a redraw', () => {
    const pts = [{ id: 'p1', lat: 1, lng: 2, label: 'P' }]
    const a = vi.fn(); const b = vi.fn(); const ca = vi.fn(); const cb = vi.fn()
    const { rerender } = render(<RadiusMap center={C} radiusKm={5} points={pts} onPickPoint={a} onCenterChange={ca} />)
    rerender(<RadiusMap center={C} radiusKm={5} points={pts} onPickPoint={b} onCenterChange={cb} />)
    h.pinHandlers[0]({ originalEvent: {} })
    h.mapHandlers.click({ latlng: { lat: 53, lng: 6 } })
    expect(b).toHaveBeenCalledWith('p1')
    expect(a).not.toHaveBeenCalled()
    expect(cb).toHaveBeenCalledWith(53, 6)
    expect(ca).not.toHaveBeenCalled()
  })
})
