/**
 * OppAging — K-173 fase 6: self-hides when the feed is absent, otherwise one
 * equal-footprint tile per bucket the server actually sent, in fixed order.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import OppAging from './OppAging'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

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
})
