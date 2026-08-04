/**
 * Timeline — the application drawer's Tijdlijn tab (Danny 05-08 live finding,
 * screenshot on the Sollicitatie drill-down): (1) raw ISO strings rendered
 * instead of a formatted date+time, (2) the dots had no connecting line. Both
 * are regression-guarded here. Real useDateFormat/i18n runs (this file is not
 * mocked elsewhere, so there is no legacy raw-key assertion to preserve).
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Timeline, { type TimelineItem } from './Timeline'

const RAW_ISO = '2026-08-04T17:30:00+00:00'

const item = (over: Partial<TimelineItem> = {}): TimelineItem => ({
  id: 'e-1', author: 'Danny Polak', initials: 'DP', time: RAW_ISO, description: 'Fase gewijzigd', ...over,
})

describe('Timeline · date formatting', () => {
  it('renders a formatted DD-MM-YYYY, HH:mm date, never the raw ISO string', () => {
    render(<Timeline items={[item()]} />)
    expect(screen.getByText('Danny Polak')).toBeInTheDocument()
    // Which calendar day/hour this resolves to depends on the runner's timezone
    // (RAW_ISO carries an explicit UTC offset) — so the SHAPE is asserted
    // (DD-MM-YYYY, HH:mm), not a pinned day; formatDateTime itself is exact-value
    // tested in lib/datetime.test.ts with a timezone-stable local input.
    expect(screen.getByText(/^\d{2}-\d{2}-\d{4}, \d{2}:\d{2}$/)).toBeInTheDocument()
    expect(screen.queryByText(RAW_ISO)).toBeNull()
    expect(screen.queryByText(/T17:30:00/)).toBeNull()
  })

  it('shows the calm empty state when there is nothing on the timeline', () => {
    render(<Timeline items={[]} emptyText="Nog geen gebeurtenissen" />)
    expect(screen.getByText('Nog geen gebeurtenissen')).toBeInTheDocument()
  })
})

describe('Timeline · connector rail', () => {
  it('draws no dangling connector after a single item', () => {
    render(<Timeline items={[item()]} />)
    expect(screen.getByTestId('timeline-dot')).toBeInTheDocument()
    expect(screen.queryByTestId('timeline-connector')).toBeNull()
  })

  it('connects every item except the last', () => {
    render(<Timeline items={[item({ id: 'e-1' }), item({ id: 'e-2' }), item({ id: 'e-3' })]} />)
    expect(screen.getAllByTestId('timeline-dot')).toHaveLength(3)
    // 3 items → 2 connector segments, none trailing the final dot.
    expect(screen.getAllByTestId('timeline-connector')).toHaveLength(2)
  })
})
