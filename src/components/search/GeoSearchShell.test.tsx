/**
 * GeoSearchShell — GEOSEARCH-1 (Danny 22-08): the ONE layout both geo-search
 * drawer tabs (candidate → vacancy, vacancy → candidate) now mount. Purely
 * presentational, so this suite proves the shell's own contract: every slot
 * renders where it should, the radius controls fire `onChange`, the point
 * count renders, and the radius/actions row degrades gracefully when either
 * (or both) are absent.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
// Real i18next instance so t() resolves the actual common:map.* strings.
import '@/i18n'
import GeoSearchShell from './GeoSearchShell'

const baseRadius = { value: 30, onChange: vi.fn(), count: 4, countLabel: '4 op de kaart' }

describe('GeoSearchShell · slots', () => {
  it('renders triggers, chips, actions, map and results where each is passed', () => {
    render(
      <GeoSearchShell
        triggers={<div>TRIGGERS</div>}
        chips={<div>CHIPS</div>}
        actions={<div>ACTIONS</div>}
        radius={baseRadius}
        map={<div>MAP</div>}
        results={<div>RESULTS</div>}
      />,
    )
    expect(screen.getByText('TRIGGERS')).toBeInTheDocument()
    expect(screen.getByText('CHIPS')).toBeInTheDocument()
    expect(screen.getByText('ACTIONS')).toBeInTheDocument()
    expect(screen.getByText('MAP')).toBeInTheDocument()
    expect(screen.getByText('RESULTS')).toBeInTheDocument()
  })

  it('renders nothing extra for the optional chips slot when omitted', () => {
    render(<GeoSearchShell triggers={<div>TRIGGERS</div>} map={<div>MAP</div>} results={<div>RESULTS</div>} />)
    expect(screen.getByText('TRIGGERS')).toBeInTheDocument()
    expect(screen.queryByText('CHIPS')).toBeNull()
  })
})

describe('GeoSearchShell · radius controls', () => {
  it('renders the slider + km input at the given value and the resolved count line', () => {
    render(<GeoSearchShell triggers={null} map={<div>MAP</div>} results={<div>RESULTS</div>} radius={baseRadius} />)
    expect(screen.getByRole('slider', { name: 'Straal' })).toHaveAttribute('aria-valuenow', '30')
    expect(screen.getByRole('spinbutton', { name: 'Straal' })).toHaveValue(30)
    expect(screen.getByText('4 op de kaart')).toBeInTheDocument()
  })

  it('fires radius.onChange with the typed km value', () => {
    const onChange = vi.fn()
    render(<GeoSearchShell triggers={null} map={<div>MAP</div>} results={<div>RESULTS</div>}
      radius={{ ...baseRadius, onChange }} />)
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Straal' }), { target: { value: '80' } })
    expect(onChange).toHaveBeenCalledWith(80)
  })

  it('fires radius.onChange (floored at 5km) from a keyboard nudge on the slider thumb', () => {
    const onChange = vi.fn()
    render(<GeoSearchShell triggers={null} map={<div>MAP</div>} results={<div>RESULTS</div>}
      radius={{ ...baseRadius, value: 5, onChange }} />)
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Straal' }), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('omits the radius row entirely when `radius` is absent (GEO-DEGRADE-1: no origin to measure from)', () => {
    render(<GeoSearchShell triggers={null} map={<div>MAP</div>} results={<div>RESULTS</div>} />)
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(screen.queryByRole('slider')).toBeNull()
  })
})

describe('GeoSearchShell · actions stay visible without a location', () => {
  it('still renders `actions`, right-aligned, when `radius` is absent', () => {
    // A geocode-missing host (GEO-DEGRADE-1) must never silently lose an action
    // like "Koios-advies verversen" just because the radius chrome is hidden.
    render(<GeoSearchShell triggers={null} map={<div>MAP</div>} results={<div>RESULTS</div>} actions={<button>Koios-advies verversen</button>} />)
    expect(screen.getByRole('button', { name: 'Koios-advies verversen' })).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })
})
