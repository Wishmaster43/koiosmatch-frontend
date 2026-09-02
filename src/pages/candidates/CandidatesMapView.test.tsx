/**
 * CandidatesMapView.test — PDOK-LATLNG-1 regression (E3 audit finding): the
 * view used to filter with `typeof c.lat === 'number'`, silently dropping every
 * candidate whose coordinates arrive as decimal STRINGS (Laravel's DECIMAL
 * serialisation). Mirrors CustomersMapView.test.tsx — coerce via toCoord.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CandidatesMapView from './CandidatesMapView'
import type { Candidate } from '@/types/candidate'

// Leaflet is out of scope — the shared panel is stubbed to expose its points.
vi.mock('@/components/map/RadiusMapPanel', () => ({
  default: ({ points }: { points: Array<{ id: unknown; label: string }> }) => (
    <div data-testid="map-panel">{points.map(p => <span key={String(p.id)}>{p.label}</span>)}</div>
  ),
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ statusMeta: () => ({ color: '#000' }) }) }))

const noop = () => {}
const base = { center: { lat: 52, lng: 5 }, radiusKm: 30, onCenterChange: noop, onRadiusChange: noop, onPick: noop }

describe('CandidatesMapView · PDOK-LATLNG-1', () => {
  it('keeps candidates whose coordinates arrive as STRINGS (Laravel decimal serialisation)', () => {
    const rows = [
      { id: 'k1', name: 'Ismail Eddahchouri', lat: '52.0907', lng: '5.1214', city: 'Utrecht' },
      { id: 'k2', name: 'Sara de Vries', lat: 51.92, lng: 4.47, city: 'Rotterdam' },
      { id: 'k3', name: 'Geen coords', lat: null, lng: null },
    ] as unknown as Candidate[]
    render(<CandidatesMapView rows={rows} {...base} />)
    // Both real-coordinate rows land on the map — string or number alike.
    expect(screen.getByText('Ismail Eddahchouri')).toBeInTheDocument()
    expect(screen.getByText('Sara de Vries')).toBeInTheDocument()
    // A row without coordinates stays off the map, never a (0,0) marker.
    expect(screen.queryByText('Geen coords')).toBeNull()
  })
})

// PENDING-GEOCODE-1 (Danny 02-09): banner for rows that have an address but no
// coordinates yet; address-less rows never count.
describe('CandidatesMapView · pending geocode banner', () => {
  it('shows the banner and still renders the geocoded row when one row is pending', () => {
    const rows = [
      { id: 'k1', name: 'Ismail Eddahchouri', lat: '52.0907', lng: '5.1214', city: 'Utrecht' },
      { id: 'k3', name: 'Nog niet geocode', lat: null, lng: null, city: 'Zwolle' },
    ] as unknown as Candidate[]
    render(<CandidatesMapView rows={rows} {...base} />)
    expect(screen.getByText('candidates:map.pendingGeocode')).toBeInTheDocument()
    expect(screen.getByText('Ismail Eddahchouri')).toBeInTheDocument()
  })

  it('shows no banner once every addressed row has coordinates', () => {
    const rows = [
      { id: 'k1', name: 'Ismail Eddahchouri', lat: '52.0907', lng: '5.1214', city: 'Utrecht' },
      { id: 'k2', name: 'Sara de Vries', lat: 51.92, lng: 4.47, city: 'Rotterdam' },
    ] as unknown as Candidate[]
    render(<CandidatesMapView rows={rows} {...base} />)
    expect(screen.queryByText('candidates:map.pendingGeocode')).toBeNull()
  })

  it('does not count a row with no address at all', () => {
    const rows = [
      { id: 'k4', name: 'Zonder adres', lat: null, lng: null, city: null },
    ] as unknown as Candidate[]
    render(<CandidatesMapView rows={rows} {...base} />)
    expect(screen.queryByText('candidates:map.pendingGeocode')).toBeNull()
  })
})
