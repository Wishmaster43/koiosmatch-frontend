/**
 * RadiusMapPanel — COMPACT-1 regression coverage (Danny 09-08): the radius
 * control moved off a native <input type="range"> (rendering in the browser's
 * own blue, a second slider look right below the shared orange "Uren per
 * week" Slider) onto that SAME shared component; the click-hint + point-count
 * hint lines merged into one. Leaflet cannot run under jsdom, so RadiusMap
 * itself is stubbed — only the panel's own chrome is exercised here.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
// Real i18next instance so t() resolves actual locale strings, not raw keys.
import '@/i18n'
import RadiusMapPanel from './RadiusMapPanel'

vi.mock('@/components/map/RadiusMap', () => ({
  default: () => <div data-testid="radius-map-stub" />,
}))

const baseProps = {
  points: [],
  center: { lat: 52.09, lng: 5.12 },
  onCenterChange: vi.fn(),
  onPick: vi.fn(),
}

// The single-mode Slider renders ONE role="slider" thumb whose parent is the
// pointer-driven track (mirrors useDraggablePanel.test.ts's node-geometry stub
// — jsdom's own getBoundingClientRect always returns zeroes).
function stubTrackRect(width = 150) {
  const track = screen.getByRole('slider').parentElement as HTMLElement
  track.getBoundingClientRect = () => ({
    x: 0, y: 0, left: 0, top: 0, width, height: 24, right: width, bottom: 24, toJSON: () => ({}),
  }) as DOMRect
  return track
}

describe('RadiusMapPanel · no native browser controls (COMPACT-1 regression)', () => {
  it('never renders a native <input type="range"> or <input type="date">', () => {
    const { container } = render(<RadiusMapPanel {...baseProps} radiusKm={30} onRadiusChange={vi.fn()} />)
    expect(container.querySelector('input[type="range"]')).toBeNull()
    expect(container.querySelector('input[type="date"]')).toBeNull()
    // The shared Slider IS present — the one orange look, same as "Uren per week".
    expect(screen.getByRole('slider')).toBeInTheDocument()
  })
})

describe('RadiusMapPanel · radius slider passes the same values the native range input used to', () => {
  it('dragging the slider calls onRadiusChange with the stepped value', () => {
    const onRadiusChange = vi.fn()
    render(<RadiusMapPanel {...baseProps} radiusKm={30} onRadiusChange={onRadiusChange} />)
    const track = stubTrackRect(150)

    fireEvent.pointerDown(track, { clientX: 100, buttons: 1 })

    expect(onRadiusChange).toHaveBeenCalledWith(100)
  })

  it('still floors at 5km (the old native input min=5) instead of passing 0 through', () => {
    const onRadiusChange = vi.fn()
    render(<RadiusMapPanel {...baseProps} radiusKm={30} onRadiusChange={onRadiusChange} />)
    const track = stubTrackRect(150)

    fireEvent.pointerDown(track, { clientX: 2, buttons: 1 })

    expect(onRadiusChange).toHaveBeenCalledWith(5)
  })

  it('the exact-km number input still fires onRadiusChange directly (unchanged contract)', () => {
    const onRadiusChange = vi.fn()
    render(<RadiusMapPanel {...baseProps} radiusKm={30} onRadiusChange={onRadiusChange} />)
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Straal' }), { target: { value: '45' } })
    expect(onRadiusChange).toHaveBeenCalledWith(45)
  })
})

// FILTER-VLAK-1 (Danny 13-08, rustplan step 3): the click hint no longer runs
// as visible text next to the point count — it moved into a `title` tooltip on
// the same short caption, so the line stays just "{{n}} on the map".
describe('RadiusMapPanel · short point-count caption with a tooltip hint', () => {
  it('shows only the short point-count text, with the click hint as a title tooltip', () => {
    render(<RadiusMapPanel {...baseProps} radiusKm={30} onRadiusChange={vi.fn()} pointsLabel="3 vacatures op de kaart" />)
    const caption = screen.getByText('3 vacatures op de kaart')
    expect(caption).toBeInTheDocument()
    expect(caption).toHaveAttribute('title', 'Klik op de kaart om het middelpunt te verplaatsen')
  })
})

describe('RadiusMapPanel · Wis straal button', () => {
  it('only renders when onClearRadius is provided', () => {
    const { rerender } = render(<RadiusMapPanel {...baseProps} radiusKm={30} onRadiusChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Wis straal' })).toBeNull()

    rerender(<RadiusMapPanel {...baseProps} radiusKm={30} onRadiusChange={vi.fn()} onClearRadius={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Wis straal' })).toBeInTheDocument()
  })
})
