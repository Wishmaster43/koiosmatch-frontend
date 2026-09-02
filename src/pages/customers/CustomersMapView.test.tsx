/**
 * CustomersMapView.test — PDOK-LATLNG-1 regression (bit twice, 22-07 and 14-08
 * "alle klanten zijn weg"): Laravel serialises DECIMAL columns as strings, so a
 * `typeof === 'number'` coordinate check silently drops EVERY customer from the
 * map. The view must coerce tolerantly (toCoord) and keep string-coord rows.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CustomersMapView from './CustomersMapView'
import type { Customer } from '@/types/customer'

// Leaflet is out of scope — the shared panel is stubbed to expose its points.
vi.mock('@/components/map/RadiusMapPanel', () => ({
  default: ({ points }: { points: Array<{ id: unknown; label: string }> }) => (
    <div data-testid="map-panel">{points.map(p => <span key={String(p.id)}>{p.label}</span>)}</div>
  ),
}))

const noop = () => {}
const base = { statusColor: () => undefined, center: { lat: 52, lng: 5 }, radiusKm: 30,
  onCenterChange: noop, onRadiusChange: noop, onPick: noop }

describe('CustomersMapView · PDOK-LATLNG-1', () => {
  it('keeps customers whose coordinates arrive as STRINGS (Laravel decimal serialisation)', () => {
    const rows = [
      { id: 'c1', name: 'Zorggroep A', lat: '52.0907', lng: '5.1214', city: 'Utrecht' },
      { id: 'c2', name: 'Zorggroep B', lat: 51.92, lng: 4.47, city: 'Rotterdam' },
      { id: 'c3', name: 'Geen coords', lat: null, lng: null },
    ] as unknown as Customer[]
    render(<CustomersMapView rows={rows} {...base} />)
    // Both real-coordinate rows land on the map — string or number alike.
    expect(screen.getByText('Zorggroep A')).toBeInTheDocument()
    expect(screen.getByText('Zorggroep B')).toBeInTheDocument()
    // A row without coordinates stays off the map, never a (0,0) marker.
    expect(screen.queryByText('Geen coords')).toBeNull()
  })
})

// PENDING-GEOCODE-1 (Danny 02-09): banner for rows that have an address but no
// coordinates yet; address-less rows never count.
describe('CustomersMapView · pending geocode banner', () => {
  it('shows the banner and still renders the geocoded row when one row is pending', () => {
    const rows = [
      { id: 'c1', name: 'Zorggroep A', lat: '52.0907', lng: '5.1214', city: 'Utrecht' },
      { id: 'c3', name: 'Nog niet geocode', lat: null, lng: null, city: 'Zwolle' },
    ] as unknown as Customer[]
    render(<CustomersMapView rows={rows} {...base} />)
    expect(screen.getByText('customers:map.pendingGeocode')).toBeInTheDocument()
    expect(screen.getByText('Zorggroep A')).toBeInTheDocument()
  })

  it('shows no banner once every addressed row has coordinates', () => {
    const rows = [
      { id: 'c1', name: 'Zorggroep A', lat: '52.0907', lng: '5.1214', city: 'Utrecht' },
      { id: 'c2', name: 'Zorggroep B', lat: 51.92, lng: 4.47, city: 'Rotterdam' },
    ] as unknown as Customer[]
    render(<CustomersMapView rows={rows} {...base} />)
    expect(screen.queryByText('customers:map.pendingGeocode')).toBeNull()
  })

  it('does not count a row with no address at all', () => {
    const rows = [
      { id: 'c4', name: 'Zonder adres', lat: null, lng: null, city: null },
    ] as unknown as Customer[]
    render(<CustomersMapView rows={rows} {...base} />)
    expect(screen.queryByText('customers:map.pendingGeocode')).toBeNull()
  })
})
