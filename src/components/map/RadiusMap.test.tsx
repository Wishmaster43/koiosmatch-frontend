/**
 * RadiusMap.test — MAP-Z-1 regression (Danny 13-08): Leaflet's internal panes
 * (z up to ~1000) punched through modals. The wrapper must form its own stacking
 * context (isolation + z 0) so every overlay above the map always wins.
 * Also covers two correctness regressions: a pin click must not also recentre
 * the map (event bubbling), and a host-driven `center` change after mount must
 * actually pan the underlying map.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import RadiusMap from './RadiusMap'

// Leaflet needs a real DOM canvas — stub the react-leaflet surface entirely; the
// seam under test is the WRAPPER's containment style, not the map internals.
// CircleMarker/Tooltip are stubbed just enough to capture the props RadiusMap
// passes them (eventHandlers, children) without rendering a real Leaflet layer.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: unknown }) => <div data-testid="map">{children as never}</div>,
  TileLayer: () => null, Circle: () => null, Marker: () => null, Popup: () => null,
  CircleMarker: ({ children, eventHandlers }: { children?: unknown; eventHandlers?: { click?: (e: unknown) => void } }) => (
    <div data-testid="pin" onClick={() => eventHandlers?.click?.({ originalEvent: {} })}>{children as never}</div>
  ),
  Tooltip: ({ children }: { children?: unknown }) => <div>{children as never}</div>,
  useMapEvents: (handlers: { click?: (e: unknown) => void }) => { mapClickHandler = handlers.click; return null },
  useMap: () => ({ setView, getZoom: () => 9, attributionControl: { setPrefix } }),
}))

// Mocked out so the stopPropagation assertion checks OUR call, not Leaflet internals.
vi.mock('leaflet', () => ({ DomEvent: { stopPropagation: vi.fn() } }))

// Spy on Leaflet's attribution prefix so the "Leaflet" corner label is provably off.
const setPrefix = vi.fn()
const setView = vi.fn()
// Captures ClickToCenter's registered handler so a map-level click can be simulated.
let mapClickHandler: ((e: unknown) => void) | undefined

describe('RadiusMap · stacking containment (MAP-Z-1)', () => {
  it('traps Leaflet in its own stacking context so overlays always win', () => {
    const { container } = render(<RadiusMap center={{ lat: 52, lng: 5 }} radiusKm={10} points={[]} height={300} />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.isolation).toBe('isolate')
    expect(wrapper.style.zIndex).toBe('0')
    expect(wrapper.style.position).toBe('relative')
  })

  // Danny 08-09: no "Leaflet" prefix in the corner; the OSM credit itself stays (tile licence).
  it('switches Leaflet\'s own attribution prefix off', () => {
    render(<RadiusMap center={{ lat: 52, lng: 5 }} radiusKm={10} points={[]} height={300} />)
    expect(setPrefix).toHaveBeenCalledWith(false)
  })
})

describe('RadiusMap · pin click does not also recentre the map', () => {
  it('stops propagation and only calls onPickPoint, never the map click handler', () => {
    const onPickPoint = vi.fn()
    const onCenterChange = vi.fn()
    const { getByTestId } = render(
      <RadiusMap center={{ lat: 52, lng: 5 }} radiusKm={10}
        points={[{ id: 'p1', lat: 52.1, lng: 5.1, label: 'Pin 1' }]}
        onPickPoint={onPickPoint} onCenterChange={onCenterChange} height={300} />
    )
    getByTestId('pin').click()
    expect(onPickPoint).toHaveBeenCalledWith('p1')
    // The map's own click-to-recentre handler must not have fired as a side effect.
    expect(onCenterChange).not.toHaveBeenCalled()
    // A real map click (via the captured ClickToCenter handler) still works.
    mapClickHandler?.({ latlng: { lat: 53, lng: 6 } })
    expect(onCenterChange).toHaveBeenCalledWith(53, 6)
  })
})

describe('RadiusMap · recentres when the host changes `center` after mount', () => {
  it('pans the map to the new center, keeping the current zoom', () => {
    const { rerender } = render(<RadiusMap center={{ lat: 52, lng: 5 }} radiusKm={10} points={[]} height={300} />)
    setView.mockClear()
    rerender(<RadiusMap center={{ lat: 53, lng: 6 }} radiusKm={10} points={[]} height={300} />)
    expect(setView).toHaveBeenCalledWith([53, 6], 9)
  })
})
