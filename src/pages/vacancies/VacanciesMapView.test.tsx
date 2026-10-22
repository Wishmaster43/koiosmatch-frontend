/**
 * VacanciesMapView.test — rij 34 (Danny 02-09, "banner ja"): vacancies with an
 * address but no coordinates yet show the shared pending-geocode banner above the
 * map; address-less rows never count; a fully located list shows no banner.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import VacanciesMapView from './VacanciesMapView'
import type { Vacancy } from '@/types/vacancy'

// Captures the points array each render hands to the panel (identity assertions).
const capture = vi.hoisted(() => ({ fn: (p: unknown): unknown => p }))

// Leaflet is out of scope — the shared panel is stubbed to expose its points.
vi.mock('@/components/map/RadiusMapPanel', () => ({
  default: ({ points }: { points: Array<{ id: unknown; label: string }> }) => (
    capture.fn(points),
    <div data-testid="map-panel">{points.map(p => <span key={String(p.id)}>{p.label}</span>)}</div>
  ),
}))
// One stable t reference, like the real hook, so memo dependencies hold across renders.
const stableT = (k: string) => k
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: stableT }) }))

const noop = () => {}
const base = { center: { lat: 52, lng: 5 }, radiusKm: 30, onCenterChange: noop, onRadiusChange: noop, onPick: noop }
const rows = (over: Array<Record<string, unknown>>) => over as unknown as Vacancy[]

describe('VacanciesMapView · pending-geocode banner (rij 34)', () => {
  it('shows the banner for an addressed row without coordinates and still plots the located row', () => {
    render(<VacanciesMapView rows={rows([
      { id: 'v1', title: 'Heftruckchauffeur', city: 'Utrecht', lat: 52.09, lng: 5.12 },
      { id: 'v2', title: 'Orderpicker', city: 'Zwolle', lat: null, lng: null },
    ])} {...base} />)
    expect(screen.getByText('vacancies:map.pendingGeocode')).toBeInTheDocument()
    expect(screen.getByText('Heftruckchauffeur')).toBeInTheDocument()
    expect(screen.queryByText('Orderpicker')).toBeNull()
  })

  it('shows no banner when every row is located', () => {
    render(<VacanciesMapView rows={rows([{ id: 'v1', title: 'Planner', city: 'Utrecht', lat: 52.09, lng: 5.12 }])} {...base} />)
    expect(screen.queryByText('vacancies:map.pendingGeocode')).toBeNull()
  })

  it('does not count a row with no address at all', () => {
    render(<VacanciesMapView rows={rows([{ id: 'v3', title: 'Zonder adres', city: '', lat: null, lng: null }])} {...base} />)
    expect(screen.queryByText('vacancies:map.pendingGeocode')).toBeNull()
  })
})

// MAP-HOST-MEMO: same rows keep the SAME points array; a changed rows array rebuilds it.
describe('VacanciesMapView · points identity', () => {
  it('passes a stable points array on re-render and a new one when rows change', () => {
    const seen: unknown[] = []
    capture.fn = (p: unknown) => seen.push(p)
    const r1 = [{ id: 'x', title: 'A', lat: 52.09, lng: 5.12, city: 'Utrecht' }] as unknown as Vacancy[]
    const { rerender } = render(<VacanciesMapView rows={r1} {...base} />)
    rerender(<VacanciesMapView rows={r1} {...base} />)
    expect(seen[1]).toBe(seen[0])
    rerender(<VacanciesMapView rows={[...r1]} {...base} />)
    expect(seen[2]).not.toBe(seen[0])
  })
})
