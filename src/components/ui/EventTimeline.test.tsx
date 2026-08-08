/**
 * EventTimeline — Danny punt 17 ("tijdlijn ziet er nog niet uit"). The old rows
 * repeated the full DD-MM-YYYY HH:mm on every line in the UI font, wrapped every
 * description in its own border, and painted every dot the same primary colour.
 * These tests pin the replacement: ONE day heading per day, the time in mono, the
 * marker colour driven by the event kind, and all four UI states (§3).
 *
 * `@/lib/datetime` is mocked with distinguishable transforms so the assertions do
 * not depend on the runner's timezone, and so t() echoes raw keys (the real i18n
 * bootstrap is only pulled in through that module) — the same pattern the sibling
 * TimelineTab/ChangelogTab tests use.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CalendarClock } from 'lucide-react'
import EventTimeline, { type TimelineEvent } from './EventTimeline'

vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({
    locale: 'nl-NL',
    formatDate: (v: string) => `DAY(${String(v).slice(0, 10)})`,
    formatDateTime: (v?: string | null) => (v ? `FULL(${v})` : '—'),
    // HH:mm straight off the ISO string — timezone-independent for these assertions.
    formatTime: (v?: string | null) => (v ? String(v).slice(11, 16) : ''),
  }),
}))

// Two events on 04-08, one on 03-08 — enough to prove per-day grouping.
const EVENTS: TimelineEvent[] = [
  { id: 'a', time: '2026-08-04T17:30:00+00:00', kind: 'appointment', text: 'Afspraak intake', meta: 'Laura Yesway' },
  { id: 'b', time: '2026-08-04T09:05:00+00:00', kind: 'stage', text: 'Fase gewijzigd' },
  { id: 'c', time: '2026-08-03T11:00:00+00:00', kind: 'stage', text: 'Sollicitatie ontvangen' },
]

const KIND = { appointment: { icon: CalendarClock, color: 'var(--color-info)' } } as const
const kindMeta = (k: string) => (KIND as Record<string, { icon: typeof CalendarClock; color: string }>)[k]

describe('EventTimeline · the four UI states (§3)', () => {
  it('renders the loading text and nothing else', () => {
    render(<EventTimeline events={[]} loading loadingText="Laden…" />)
    expect(screen.getByText('Laden…')).toBeInTheDocument()
    expect(screen.queryByTestId('timeline-dot')).toBeNull()
  })

  it('renders the error text — error wins over an empty list', () => {
    render(<EventTimeline events={[]} error errorText="Ging mis" emptyText="Niets" />)
    expect(screen.getByText('Ging mis')).toBeInTheDocument()
    expect(screen.queryByText('Niets')).toBeNull()
  })

  it('renders the calm empty state when there is no activity', () => {
    render(<EventTimeline events={[]} emptyText="Nog geen activiteit." />)
    expect(screen.getByText('Nog geen activiteit.')).toBeInTheDocument()
    expect(screen.queryByTestId('timeline-dot')).toBeNull()
  })

  it('renders every event once when the list is filled', () => {
    render(<EventTimeline events={EVENTS} emptyText="Niets" />)
    expect(screen.getAllByTestId('timeline-dot')).toHaveLength(3)
    expect(screen.queryByText('Niets')).toBeNull()
  })
})

describe('EventTimeline · day grouping', () => {
  it('states each day ONCE as a heading instead of repeating it per row', () => {
    render(<EventTimeline events={EVENTS} />)
    // Two calendar days → exactly two headings, for three events.
    expect(screen.getAllByText('DAY(2026-08-04)')).toHaveLength(1)
    expect(screen.getAllByText('DAY(2026-08-03)')).toHaveLength(1)
  })

  it('labels the most recent days relatively, via i18n — never a hardcoded word', () => {
    const today = new Date()
    const iso = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0).toISOString()
    render(<EventTimeline events={[{ id: 'x', time: iso, text: 'Vandaag gebeurd' }]} />)
    expect(screen.getByText('timeline.today')).toBeInTheDocument()
  })

  it('keeps an undated event visible under no heading, with a dash for the time', () => {
    render(<EventTimeline events={[{ id: 'n', text: 'Geen tijdstempel' }]} />)
    expect(screen.getByText('Geen tijdstempel')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

describe('EventTimeline · the row itself', () => {
  it('shows only HH:mm on the row, in JetBrains Mono (§4) — not the full timestamp', () => {
    render(<EventTimeline events={[EVENTS[0]]} />)
    const time = screen.getByText('17:30')
    // jsdom re-serialises the family with quotes, hence the optional quote.
    expect(time.getAttribute('style')).toMatch(/font-family:\s*"?JetBrains Mono"?,\s*monospace/)
    // The full moment stays reachable on hover instead of shouting on every row.
    expect(time).toHaveAttribute('title', 'FULL(2026-08-04T17:30:00+00:00)')
    expect(screen.queryByText('FULL(2026-08-04T17:30:00+00:00)')).toBeNull()
  })

  it('gives the event text full contrast and demotes the author to a muted meta line', () => {
    render(<EventTimeline events={[EVENTS[0]]} />)
    expect(screen.getByText('Afspraak intake').getAttribute('style')).toMatch(/color:\s*var\(--text\)/)
    expect(screen.getByText('Laura Yesway').getAttribute('style')).toMatch(/color:\s*var\(--text-muted\)/)
  })

  it('renders no author line at all when the backend sends none — never a bold dash', () => {
    // Verified live: every vacancy event and every application `stage` event has
    // author null. The old layout made that gap the row's bold headline.
    render(<EventTimeline events={[EVENTS[1]]} />)
    expect(screen.getByText('Fase gewijzigd')).toBeInTheDocument()
    expect(screen.queryByText('—')).toBeNull()
  })

  it('renders the caller-supplied trailing slot (e.g. the AI-generated label)', () => {
    render(<EventTimeline events={[{ id: 'a', time: EVENTS[0].time, text: 'Iets', trailing: <span>AI-gegenereerd</span> }]} />)
    expect(screen.getByText('AI-gegenereerd')).toBeInTheDocument()
  })
})

describe('EventTimeline · the axis', () => {
  it('colours the marker by event KIND, not one primary dot for everything', () => {
    render(<EventTimeline events={EVENTS} kindMeta={kindMeta} />)
    const dots = screen.getAllByTestId('timeline-dot')
    // The appointment resolves to its own token; the unmapped kinds stay neutral.
    expect(dots[0].getAttribute('style')).toMatch(/var\(--color-info\)/)
    expect(dots[1].getAttribute('style')).toMatch(/var\(--text-muted\)/)
  })

  it('runs unbroken between rows and past a day heading, terminating once', () => {
    render(<EventTimeline events={EVENTS} kindMeta={kindMeta} />)
    // 3 markers → 2 inter-row segments; the SECOND day heading adds the segment
    // that carries the axis past it. The first heading adds none (no dangle).
    expect(screen.getAllByTestId('timeline-dot')).toHaveLength(3)
    expect(screen.getAllByTestId('timeline-connector')).toHaveLength(3)
  })

  it('draws no dangling connector for a single event', () => {
    render(<EventTimeline events={[EVENTS[0]]} />)
    expect(screen.getByTestId('timeline-dot')).toBeInTheDocument()
    expect(screen.queryByTestId('timeline-connector')).toBeNull()
  })
})
