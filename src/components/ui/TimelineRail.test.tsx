/**
 * TimelineRail — the shared axis column of every Tijdlijn row (Danny 05-08:
 * "tijdlijn zijn alleen losse bolletjes, waar is de echte lijn?"; punt 17: the
 * whole thing "ziet er nog niet uit"). Pure presentational atom, so the tests
 * assert the two things a host depends on: the axis connects between rows and
 * terminates cleanly, and a meaning-carrying marker follows the §4 soft-tint
 * recipe rather than a solid fill.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CalendarClock } from 'lucide-react'
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

// Punt 17: the marker is the ONE place colour is spent on a timeline row, so it
// must follow the house soft-tint recipe — never a solid fill (§4).
describe('TimelineRail · soft-tint marker', () => {
  it('tints an icon marker with the house pair and inks the icon via chipInk', () => {
    render(<TimelineRail icon={CalendarClock} color="var(--color-info)" />)
    const style = screen.getByTestId('timeline-dot').getAttribute('style') ?? ''
    // House tint pair from lib/tint (was a private 12/36 pair — r3.5).
    expect(style).toMatch(/background:\s*color-mix\(in srgb, var\(--color-info\) 10%, transparent\)/)
    expect(style).toMatch(/border:\s*1px solid color-mix\(in srgb, var\(--color-info\) 33%, transparent\)/)
    // The icon inks via chipInk — the raw token on its own tint read under even
    // the 3:1 graphics floor; the marker is never a solid block of the token.
    expect(style).toMatch(/color:\s*color-mix\(in srgb, var\(--color-info\) 45%, var\(--text\)\)/)
    expect(style).not.toMatch(/background:\s*var\(--color-info\)/)
  })

  it('keeps the legacy bare dot when no icon is given — the NotesTab contract', () => {
    // NotesTab renders <TimelineRail isLast={…} /> with no other props; that call
    // must keep its existing solid 8px dot, so this atom stays safe to share.
    render(<TimelineRail />)
    const style = screen.getByTestId('timeline-dot').getAttribute('style') ?? ''
    expect(style).toMatch(/background:\s*var\(--color-primary\)/)
    expect(style).toMatch(/width:\s*8px/)
  })

  it('hides the marker from screen readers — the row text already names the event', () => {
    render(<TimelineRail icon={CalendarClock} />)
    expect(screen.getByTestId('timeline-dot')).toHaveAttribute('aria-hidden', 'true')
  })
})

// The axis has to survive a day heading: it runs BESIDE the heading (connector),
// but must not dangle above the very first marker (spacer).
describe('TimelineRail · day-heading variants', () => {
  it('carries the axis past a day heading with a line and no marker', () => {
    render(<TimelineRail variant="connector" />)
    expect(screen.getByTestId('timeline-connector')).toBeInTheDocument()
    expect(screen.queryByTestId('timeline-dot')).toBeNull()
  })

  it('reserves the axis width without drawing a line above the first heading', () => {
    render(<TimelineRail variant="spacer" />)
    expect(screen.queryByTestId('timeline-connector')).toBeNull()
    expect(screen.queryByTestId('timeline-dot')).toBeNull()
  })
})
