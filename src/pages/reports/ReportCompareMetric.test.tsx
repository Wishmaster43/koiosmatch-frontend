/**
 * ReportCompareMetric — a null delta_pct (previous window was zero) MUST render
 * the house dash, never "0%"/"Infinity%". Tone follows the figure's own polarity,
 * never the raw delta sign (mirrors reportComparePolarity.test.ts at the render layer).
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReportCompareMetric from './ReportCompareMetric'

describe('ReportCompareMetric', () => {
  it('renders the house dash for a null delta_pct — never a fabricated 0%', () => {
    render(<ReportCompareMetric metric={{ current: 5, previous: 0, delta: 5, delta_pct: null }} polarity="up-good" />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument()
  })

  it('colours a rise in an up-good figure with the success token', () => {
    render(<ReportCompareMetric metric={{ current: 12, previous: 10, delta: 2, delta_pct: 20 }} polarity="up-good" />)
    const value = screen.getByText('+2')
    expect(value.parentElement).toHaveStyle({ color: 'var(--color-success-text)' })
  })

  it('colours a rise in a down-good figure (e.g. rejections) with the danger token — not green', () => {
    render(<ReportCompareMetric metric={{ current: 12, previous: 10, delta: 2, delta_pct: 20 }} polarity="down-good" />)
    const value = screen.getByText('+2')
    expect(value.parentElement).toHaveStyle({ color: 'var(--color-danger-text)' })
  })
})
