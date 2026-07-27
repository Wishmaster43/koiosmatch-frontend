/**
 * LocationsMapView — regression for the coordinate-typing trap (§10, audit 2026-07-27).
 * The host settings screen passes RAW API rows and Laravel serialises DECIMAL columns
 * as STRINGS, so the old `typeof l.lat === 'number'` filter dropped every geocoded
 * office and left the tenant looking at an empty map. Same class as PDOK-LATLNG-1.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import LocationsMapView from './LocationsMapView'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

// The map itself is out of scope here — capture the points it receives instead, which
// is exactly what the coercion bug corrupted.
const received: Array<{ points: Array<{ label: string }> }> = []
vi.mock('@/components/map/RadiusMapPanel', () => ({
  default: (props: { points: Array<{ label: string }> }) => {
    received.push({ points: props.points })
    return <div data-testid="map">{props.points.map(p => <span key={p.label}>{p.label}</span>)}</div>
  },
}))

describe('LocationsMapView', () => {
  it('plots offices whose coordinates arrive as STRINGS, not just as numbers', () => {
    render(<LocationsMapView locations={[
      { id: '1', name: 'Yesway Breda', city: 'Breda', lat: '51.5719', lng: '4.7683' },
      { id: '2', name: 'Yesway Utrecht', city: 'Utrecht', lat: 52.0907, lng: 5.1214 },
    ] as never} />)
    expect(screen.getByText('Yesway Breda')).toBeInTheDocument()
    expect(screen.getByText('Yesway Utrecht')).toBeInTheDocument()
  })

  it('skips rows that genuinely have no usable coordinates', () => {
    render(<LocationsMapView locations={[
      { id: '3', name: 'Zonder adres', city: '', lat: null, lng: null },
      { id: '4', name: 'Leeg', city: '', lat: '', lng: '' },
    ] as never} />)
    expect(screen.queryByText('Zonder adres')).toBeNull()
    expect(screen.queryByText('Leeg')).toBeNull()
  })
})
