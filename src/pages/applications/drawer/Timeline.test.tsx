/**
 * Timeline — the application drawer's Tijdlijn tab. Guards two rounds of live
 * findings: (05-08) raw ISO strings instead of a formatted moment and dots with no
 * connecting line, and (punt 17) the redesign — the full date is stated once per
 * day heading instead of on every row, the time is mono, and the event kind (read
 * off the backend's composite id, verified live) drives a meaning-carrying marker.
 * Real useDateFormat/i18n runs here, so the assertions are on shape, not on a
 * pinned timezone-dependent value.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Timeline, { kindOf, type TimelineItem } from './Timeline'

const RAW_ISO = '2026-08-04T17:30:00+00:00'

const item = (over: Partial<TimelineItem> = {}): TimelineItem => ({
  id: 'stage:e-1', author: 'Danny Polak', initials: 'DP', time: RAW_ISO, description: 'Fase gewijzigd', ...over,
})

// The backend sends no `type` on an application event — only `"<kind>:<uuid>"`.
describe('kindOf · event kind from the composite id', () => {
  it('reads the kind off the real backend ids', () => {
    expect(kindOf('appointment:019fe307-a7b6-7241-ad70-dfd225e84523')).toBe('appointment')
    expect(kindOf('stage:019fe307-a7df-718a-babc-31ad6ac0b13e')).toBe('stage')
  })

  it('never guesses a kind from an unprefixed or missing id', () => {
    // A bare UUID contains dashes but no colon — it must not be split into a kind.
    expect(kindOf('019fe307-a7b6-7241-ad70-dfd225e84523')).toBe('')
    expect(kindOf(undefined)).toBe('')
    expect(kindOf(':leading')).toBe('')
  })
})

describe('Timeline · date rendering', () => {
  it('shows HH:mm on the row and the calendar day once, never the raw ISO string', () => {
    render(<Timeline items={[item()]} />)
    // Which hour this resolves to depends on the runner's timezone (RAW_ISO carries
    // an explicit UTC offset), so the SHAPE is asserted; formatTime/formatDate are
    // exact-value tested in lib/datetime.test.ts with timezone-stable inputs.
    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeInTheDocument()
    // The day heading is a plain long date — not another DD-MM-YYYY HH:mm stamp.
    expect(screen.getByText(/^\d{1,2} \p{L}+ 2026$/u)).toBeInTheDocument()
    expect(screen.queryByText(RAW_ISO)).toBeNull()
    expect(screen.queryByText(/T17:30:00/)).toBeNull()
    expect(screen.queryByText(/^\d{2}-\d{2}-\d{4}, \d{2}:\d{2}$/)).toBeNull()
  })

  it('states a shared day ONCE for several events on it', () => {
    render(<Timeline items={[item({ id: 'stage:1' }), item({ id: 'stage:2', time: '2026-08-04T09:05:00+00:00' })]} />)
    expect(screen.getAllByText(/^\d{1,2} \p{L}+ 2026$/u)).toHaveLength(1)
    expect(screen.getAllByTestId('timeline-dot')).toHaveLength(2)
  })

  it('shows the calm empty state when there is nothing on the timeline', () => {
    render(<Timeline items={[]} emptyText="Nog geen gebeurtenissen" />)
    expect(screen.getByText('Nog geen gebeurtenissen')).toBeInTheDocument()
    expect(screen.queryByTestId('timeline-dot')).toBeNull()
  })
})

describe('Timeline · the author is context, not the headline', () => {
  it('renders the author as the muted meta line under the event', () => {
    render(<Timeline items={[item()]} />)
    expect(screen.getByText('Danny Polak').getAttribute('style')).toMatch(/color:\s*var\(--text-muted\)/)
    expect(screen.getByText('Fase gewijzigd').getAttribute('style')).toMatch(/color:\s*var\(--text\)/)
  })

  it('renders no dash placeholder for a system event with no author', () => {
    // Verified live: every `stage:` event comes back with author null.
    render(<Timeline items={[item({ author: '' })]} />)
    expect(screen.getByText('Fase gewijzigd')).toBeInTheDocument()
    expect(screen.queryByText('—')).toBeNull()
  })
})

// AI-ACT-1: an `ai` entry used to render only a bare KoiosAiMark icon with no
// visible text — replaced by the shared AiGeneratedLabel so the disclosure is
// icon+text, never colour/icon-only (§6).
describe('Timeline · AI-generated disclosure (AI-ACT-1)', () => {
  it('shows the AI-generated label on an ai-flagged item', () => {
    render(<Timeline items={[item({ ai: true })]} />)
    expect(screen.getByText('AI-gegenereerd')).toBeInTheDocument()
  })

  it('shows nothing extra on a human-authored item', () => {
    render(<Timeline items={[item({ ai: false })]} />)
    expect(screen.queryByText('AI-gegenereerd')).toBeNull()
  })
})

describe('Timeline · connector rail', () => {
  it('draws no dangling connector after a single item', () => {
    render(<Timeline items={[item()]} />)
    expect(screen.getByTestId('timeline-dot')).toBeInTheDocument()
    expect(screen.queryByTestId('timeline-connector')).toBeNull()
  })

  it('connects every item except the last', () => {
    render(<Timeline items={[
      item({ id: 'stage:1' }),
      item({ id: 'stage:2', time: '2026-08-04T12:00:00+00:00' }),
      item({ id: 'stage:3', time: '2026-08-04T09:00:00+00:00' }),
    ]} />)
    expect(screen.getAllByTestId('timeline-dot')).toHaveLength(3)
    // One calendar day → one heading that adds no segment, so 3 items → 2 segments.
    expect(screen.getAllByTestId('timeline-connector')).toHaveLength(2)
  })

  it('gives an appointment its own semantic marker colour, not the same dot as a stage change', () => {
    render(<Timeline items={[
      item({ id: 'appointment:1', description: 'Afspraak intake' }),
      item({ id: 'stage:2', time: '2026-08-04T09:00:00+00:00' }),
    ]} />)
    const dots = screen.getAllByTestId('timeline-dot')
    expect(dots[0].getAttribute('style')).toMatch(/var\(--color-info\)/)
    expect(dots[1].getAttribute('style')).toMatch(/var\(--color-primary\)/)
  })
})
