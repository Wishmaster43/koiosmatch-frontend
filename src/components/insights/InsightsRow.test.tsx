/**
 * InsightsRow · the `notice` prop (STATS-OOM-1): a data-honesty banner shown when
 * server-wide stats failed and the cards silently fell back to page-scope counts —
 * rendered when set, absent entirely when not. No donuts/kpis needed for this gap.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InsightsRow, { CARD_MIN_WIDTH } from './InsightsRow'

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
    expect(clearBtn).toHaveInlineStyle({ background: 'var(--button-fill)', color: 'var(--button-ink)' })
    fireEvent.mouseEnter(clearBtn)
    expect(clearBtn).toHaveInlineStyle({ background: 'var(--button-fill)', color: 'var(--button-ink)' })
    fireEvent.mouseLeave(clearBtn)
    expect(clearBtn).toHaveInlineStyle({ background: 'var(--button-fill)', color: 'var(--button-ink)' })
  })
})

// CMFE-KPI-1: a card never shrinks below its floor, so a strip that does not fit (1280×720 with an open
// drawer) scrolls horizontally instead of overlapping donuts and one-letter labels.
describe('InsightsRow · card minimum width (CMFE-KPI-1)', () => {
  it('gives every donut and KPI card the shared minimum width and keeps the strip horizontally scrollable', () => {
    const { container } = render(
      <InsightsRow
        donuts={[{ key: 'status', title: 'Status', data: [{ name: 'a', value: 3 }] }]}
        kpis={[{ key: 'a', label: 'A', value: 1 }, { key: 'b', label: 'B', value: 2 }]}
      />,
    )
    const strip = container.firstElementChild as HTMLElement
    expect(strip).toHaveInlineStyle({ overflowX: 'auto' })
    const cards = Array.from(strip.children) as HTMLElement[]
    expect(cards).toHaveLength(3)
    for (const card of cards) expect(card).toHaveInlineStyle({ minWidth: `${CARD_MIN_WIDTH}px` })
  })

  it('keeps the floor at 80px so no page changes at 1280px without a drawer (eleven cards fit 1012px)', () => {
    expect(CARD_MIN_WIDTH).toBe(80)
  })
})

// Screen probe 13-11: a wrapped card label broke mid-word ("HOOFDKANTO / OR"). The wrap breaks on word
// boundaries and leaves an over-long single word to hyphenation, never a hard cut as the first resort.
describe('InsightsRow · wrapped label breaks on words (KPI band)', () => {
  it('uses break-word with hyphenation on a wrapped label and keeps the full label in the tooltip', () => {
    render(<InsightsRow wrapLabels kpis={[{ key: 'hq', label: 'Hoofdkantoor', value: 3 }]} />)
    const label = screen.getByText('Hoofdkantoor') as HTMLElement
    expect(label.style.overflowWrap).toBe('break-word')
    expect(label.style.whiteSpace).toBe('normal')
    expect(label.getAttribute('title')).toBe('Hoofdkantoor')
  })

  it('keeps the single-line ellipsis strip when wrapLabels is off', () => {
    render(<InsightsRow kpis={[{ key: 'hq', label: 'Hoofdkantoor', value: 3 }]} />)
    expect((screen.getByText('Hoofdkantoor') as HTMLElement).style.whiteSpace).toBe('nowrap')
  })
})

