/**
 * TimelineRail — the shared dot + connector line rendered on every Tijdlijn/
 * changelog row (Danny 05-08: "tijdlijn zijn alleen losse bolletjes, waar is de
 * echte lijn?"). Pure presentational atom: assert the connector renders between
 * items and terminates cleanly on the last one.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TimelineRail from './TimelineRail'

describe('TimelineRail', () => {
  it('always renders the dot', () => {
    render(<TimelineRail />)
    expect(screen.getByTestId('timeline-dot')).toBeInTheDocument()
  })

  it('renders the connector line when it is NOT the last item', () => {
    render(<TimelineRail isLast={false} />)
    expect(screen.getByTestId('timeline-connector')).toBeInTheDocument()
  })

  it('terminates cleanly — no connector line on the last item', () => {
    render(<TimelineRail isLast />)
    expect(screen.queryByTestId('timeline-connector')).toBeNull()
  })

  it('a single-item list (first === last) never draws a dangling line', () => {
    // Mirrors how every host computes isLast: i === items.length - 1.
    const items = ['only-one']
    render(
      <>
        {items.map((_, i) => <TimelineRail key={i} isLast={i === items.length - 1} />)}
      </>,
    )
    expect(screen.queryByTestId('timeline-connector')).toBeNull()
  })

  it('a multi-item list draws a connector after every item except the last', () => {
    const items = ['a', 'b', 'c']
    render(
      <>
        {items.map((_, i) => <TimelineRail key={i} isLast={i === items.length - 1} />)}
      </>,
    )
    // 3 items → 2 connectors (between 1-2 and 2-3), none trailing the last dot.
    expect(screen.getAllByTestId('timeline-connector')).toHaveLength(2)
    expect(screen.getAllByTestId('timeline-dot')).toHaveLength(3)
  })
})
