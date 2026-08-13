/**
 * InsightsRow · the `notice` prop (STATS-OOM-1): a data-honesty banner shown when
 * server-wide stats failed and the cards silently fell back to page-scope counts —
 * rendered when set, absent entirely when not. No donuts/kpis needed for this gap.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

// Regression: on mouse-leave the donut clear button must restore the readable
// --color-primary-text token, never the raw --color-primary (unreadable on a
// light brand colour such as AENF yellow).
describe('InsightsRow · donut clear button colour', () => {
  it('restores the primary-text token, not the raw primary, on mouse leave', () => {
    render(
      <InsightsRow
        donuts={[{ key: 'status', data: [{ label: 'A', value: 1 }], active: true, onClear: () => {}, picked: 'A' }]}
      />
    )
    const clearBtn = screen.getByRole('button')
    fireEvent.mouseEnter(clearBtn)
    expect(clearBtn).toHaveStyle({ color: 'var(--color-on-accent)' })
    fireEvent.mouseLeave(clearBtn)
    expect(clearBtn).toHaveStyle({ color: 'var(--color-primary-text)' })
  })
})
