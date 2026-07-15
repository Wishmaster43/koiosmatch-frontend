/**
 * InsightsRow · the `notice` prop (STATS-OOM-1): a data-honesty banner shown when
 * server-wide stats failed and the cards silently fell back to page-scope counts —
 * rendered when set, absent entirely when not. No donuts/kpis needed for this gap.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import InsightsRow from './InsightsRow'

describe('InsightsRow · notice', () => {
  it('renders the notice text in a role="status" banner when set', () => {
    render(<InsightsRow notice="Totals reflect this page only — server-wide stats are unavailable." />)
    const el = screen.getByRole('status')
    expect(el).toHaveTextContent('Totals reflect this page only — server-wide stats are unavailable.')
  })

  it('renders no status banner when notice is absent', () => {
    render(<InsightsRow />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('renders no status banner for an empty-string notice', () => {
    render(<InsightsRow notice="" />)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
