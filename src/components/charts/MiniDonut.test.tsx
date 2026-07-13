import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MiniDonut from './MiniDonut'

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
})
