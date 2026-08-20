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

// HUISSTIJL-1 (Opus-F residual triage, 20-08): the donut clear button now reads
// the static house trio (solid at rest) instead of a hover-driven tint→solid
// swap — --button-ink is already the theme's contrast-safe ink for --button-fill
// (Button.tsx's clampedOnAccent), so there is no second colour to restore on
// mouse-leave any more; this replaces the old hover-regression test above.
describe('InsightsRow · donut clear button colour', () => {
  it('reads the solid house trio at rest, unaffected by hover', () => {
    render(
      <InsightsRow
        donuts={[{ key: 'status', data: [{ label: 'A', value: 1 }], active: true, onClear: () => {}, picked: 'A' }]}
      />
    )
    const clearBtn = screen.getByRole('button')
    expect(clearBtn).toHaveStyle({ background: 'var(--button-fill)', color: 'var(--button-ink)' })
    fireEvent.mouseEnter(clearBtn)
    expect(clearBtn).toHaveStyle({ background: 'var(--button-fill)', color: 'var(--button-ink)' })
    fireEvent.mouseLeave(clearBtn)
    expect(clearBtn).toHaveStyle({ background: 'var(--button-fill)', color: 'var(--button-ink)' })
  })
})
