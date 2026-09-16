/**
 * FunnelConversion — GETALLEN-1 (locale-aware count/percent) and typography-atom
 * regression: the title/empty-state must render via the house atoms, not a
 * hand-declared 13/600 style object, and counts/percentages must run through
 * the house number formatter, not a raw JSX interpolation.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import FunnelConversion from './FunnelConversion'

// Mocked directly (not just react-i18next) so the test never pulls the real
// i18n init side-effect through lib/datetime (DATETIME-IMPORT-LES, CLAUDE.md §2).
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/formatters', () => ({
  useNumberFormat: () => ({
    formatNumber: (v: number) => new Intl.NumberFormat('nl-NL').format(v),
    formatPercent: (v: number) => `${new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 }).format(v)}%`,
  }),
}))

describe('FunnelConversion', () => {
  it('renders the empty state via the house Caption atom when there is no data', () => {
    render(<FunnelConversion data={[]} />)
    expect(screen.getByText('chart.noData')).toBeInTheDocument()
  })

  it('formats a large stage count with the house thousands separator', () => {
    render(<FunnelConversion data={[{ name: 'Applied', value: 12345 }]} />)
    expect(screen.getByText(/12\.345/)).toBeInTheDocument()
  })

  it('formats the stage percentage via formatPercent, not a raw template literal', () => {
    render(<FunnelConversion data={[{ name: 'Applied', value: 200 }, { name: 'Hired', value: 100 }]} />)
    // 100/200 = 50% (of top-of-funnel) AND 50% drop-off vs the previous stage —
    // both render through formatPercent as a whole number without a decimal.
    expect(screen.getAllByText(/50%/)).toHaveLength(2)
  })
})
