/**
 * OppAging — K-173 fase 6: self-hides when the feed is absent, otherwise one
 * equal-footprint tile per bucket the server actually sent, in fixed order.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import OppAging from './OppAging'

// Mocked directly (not just react-i18next) so the test never pulls the real
// i18n init side-effect through lib/datetime (DATETIME-IMPORT-LES, CLAUDE.md §2).
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/formatters', () => ({
  useNumberFormat: () => ({ formatNumber: (v: number) => new Intl.NumberFormat('nl-NL').format(v) }),
}))

describe('OppAging', () => {
  it('renders nothing when the feed is empty (absent for a non-sales role)', () => {
    const { container } = render(<OppAging rows={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders one tile per bucket the server sent, in the fixed 0-7…90+ order', () => {
    render(<OppAging rows={[{ bucket: '90+', count: 2 }, { bucket: '0-7', count: 5 }]} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    // A bucket the server omitted (8-30/31-90 here) renders no tile at all.
    expect(screen.getByText('oppAging.bucket.0-7')).toBeInTheDocument()
    expect(screen.queryByText('oppAging.bucket.8-30')).not.toBeInTheDocument()
  })

  // GETALLEN-1 regression: a count runs through the house formatter, so a
  // five-digit bucket count keeps its locale-aware thousands separator.
  it('formats a large bucket count through the house number formatter', () => {
    render(<OppAging rows={[{ bucket: '0-7', count: 12345 }]} />)
    expect(screen.getByText('12.345')).toBeInTheDocument()
  })
})
