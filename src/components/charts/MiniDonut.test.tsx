import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MiniDonut, { MiniTooltip } from './MiniDonut'

// Note: i18n is not initialised in tests → locale falls back to nl-NL (§3B),
// same convention as datetime.test.ts / formatters.test.ts.
describe('MiniDonut', () => {
  it('shows the full grouped number for a small total', () => {
    render(<MiniDonut data={[{ name: 'A', value: 4000 }, { name: 'B', value: 5999 }]} />)
    // 9999 stays fully grouped — no compact abbreviation for a value under the threshold.
    expect(screen.getByText('9.999')).toBeInTheDocument()
  })

  it('switches to compact notation once the total overflows the ring, with the full number as a tooltip', () => {
    render(<MiniDonut data={[{ name: 'A', value: 50000 }, { name: 'B', value: 49968 }]} />)
    // 99968 → compact center label ("100K"-style) …
    const center = screen.getByTitle('99.968')
    expect(center.textContent?.toLowerCase()).toContain('k')
  })

  // FMT-GETAL-1 fast-follow: the segment tooltip rendered its raw value with no
  // thousands separator at all — the one number in this file the center-label fix missed.
  it('groups the segment value in the hover tooltip (nl-NL)', () => {
    render(<MiniTooltip active payload={[{ value: 12345, name: 'A', payload: { fill: '#000' } }]} total={20000} />)
    expect(screen.getByText('12.345 · 62%')).toBeInTheDocument()
  })
})
