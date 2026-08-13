/**
 * RadiusMap.test — MAP-Z-1 regression (Danny 13-08): Leaflet's internal panes
 * (z up to ~1000) punched through modals. The wrapper must form its own stacking
 * context (isolation + z 0) so every overlay above the map always wins.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import RadiusMap from './RadiusMap'

// Leaflet needs a real DOM canvas — stub the react-leaflet surface entirely; the
// seam under test is the WRAPPER's containment style, not the map internals.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: unknown }) => <div data-testid="map">{children as never}</div>,
  TileLayer: () => null, Circle: () => null, Marker: () => null, Popup: () => null,
  useMapEvents: () => null, useMap: () => ({ setView: () => {} }),
}))

describe('RadiusMap · stacking containment (MAP-Z-1)', () => {
  it('traps Leaflet in its own stacking context so overlays always win', () => {
    const { container } = render(<RadiusMap center={{ lat: 52, lng: 5 }} radiusKm={10} points={[]} height={300} />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.isolation).toBe('isolate')
    expect(wrapper.style.zIndex).toBe('0')
    expect(wrapper.style.position).toBe('relative')
  })
})
