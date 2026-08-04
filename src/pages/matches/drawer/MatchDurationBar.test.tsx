/**
 * MatchDurationBar (M25/M26) — renders only once both dates are set; the
 * progressbar's aria-valuenow carries the computed elapsed %.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MatchDurationBar from './MatchDurationBar'

describe('MatchDurationBar', () => {
  it('renders nothing when either date is missing (no fake bar)', () => {
    const { container: a } = render(<MatchDurationBar startDate={null} endDate="2026-09-01" />)
    expect(a).toBeEmptyDOMElement()
    const { container: b } = render(<MatchDurationBar startDate="2026-08-01" endDate={null} />)
    expect(b).toBeEmptyDOMElement()
  })

  it('renders a progressbar with the computed elapsed percentage once both dates are set', () => {
    render(<MatchDurationBar startDate="2026-01-01" endDate="2026-06-01" />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(Number(bar.getAttribute('aria-valuenow'))).toBe(100) // already past the end date "now"
  })
})
