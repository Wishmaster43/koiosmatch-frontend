/**
 * V21-23 — the vacancy timeline is CLICKABLE. Regression guard for the state
 * this replaced: the tab rendered every event as dead text, so "sollicitatie
 * ontvangen" / "match gemaakt" named a record the recruiter could not open.
 * Asserts the real navigation seam (which page + which id) and the new-tab
 * anchor's rel hardening, not merely that something rendered.
 *
 * Punt 17 (redesign) adds: the day is stated once as a heading, the row carries
 * only HH:mm, and the event kind drives a meaning-carrying marker colour.
 *
 * `@/lib/datetime` is mocked (mirrors src/pages/*\/drawer/ChangelogTab.test.tsx):
 * the tab formats `time` through that hook, and it transitively imports the real
 * i18n bootstrap, which would load REAL translations and break the literal-key
 * assertions below (`t('timeline.openApplication')` etc.). The mock keeps those
 * intact; the formatters' own output is asserted for real in datetime.test.ts.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TimelineTab from './TimelineTab'
import { NavigationProvider } from '@/context/NavigationContext'
import type { VacancyDetail, VacancyTimelineEvent } from '@/types/vacancy'

// Distinguishable (not identity) transforms: prove the component ROUTES `time`
// through the house formatters rather than rendering the raw field directly.
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({
    locale: 'nl-NL',
    formatDate: (v: string) => `DAY(${String(v).slice(0, 10)})`,
    formatDateTime: (v?: string | null) => (v ? `FULL(${v})` : '—'),
    formatTime: (v?: string | null) => (v ? String(v).slice(11, 16) : ''),
  }),
}))

const UUID = '9f1c2b3d-4e5f-6071-8293-a4b5c6d7e8f9'

const event = (over: Partial<VacancyTimelineEvent>): VacancyTimelineEvent => ({
  id: 'e-1', type: 'note', author: 'Danny Polak', initials: 'DP',
  description: 'Klant gebeld', ai: false, time: '2026-07-24T09:00:00+02:00',
  linkPage: null, linkId: null, ...over,
})

const renderTab = (timeline: VacancyTimelineEvent[], goTo = vi.fn()) => {
  render(
    <NavigationProvider goTo={goTo}>
      <TimelineTab vacancy={{ id: 'v-1', timeline } as VacancyDetail} />
    </NavigationProvider>,
  )
  return goTo
}

describe('TimelineTab', () => {
  it('opens the application in-app when its description is clicked', async () => {
    const goTo = renderTab([event({
      id: `application-${UUID}`, type: 'application', description: 'Sollicitatie ontvangen — Intake',
      linkPage: 'applications', linkId: UUID,
    })])

    await userEvent.click(screen.getByRole('button', { name: 'Sollicitatie ontvangen — Intake' }))
    expect(goTo).toHaveBeenCalledWith('applications', { open: UUID })
  })

  it('offers a hardened new-tab deep link carrying the bare uuid', () => {
    renderTab([event({
      id: `match-${UUID}`, type: 'match', description: 'Match gemaakt (concept)',
      linkPage: 'matches', linkId: UUID,
    })])

    const anchor = screen.getByRole('link', { name: 'openInNewTab' })
    expect(anchor.getAttribute('href')).toContain(`#matches?open=${UUID}`)
    expect(anchor.getAttribute('target')).toBe('_blank')
    expect(anchor.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('labels the link with its own event-kind tooltip', () => {
    renderTab([event({
      id: `application-${UUID}`, type: 'application', description: 'Sollicitatie ontvangen',
      linkPage: 'applications', linkId: UUID,
    })])
    expect(screen.getByRole('button', { name: 'Sollicitatie ontvangen' }).getAttribute('title'))
      .toBe('timeline.openApplication')
  })

  it('keeps an unlinkable event (a note) as plain text — no fake affordance', () => {
    renderTab([event({ id: `note-${UUID}`, description: 'Klant gebeld' })])
    expect(screen.getByText('Klant gebeld')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('shows the calm empty state when there is no activity', () => {
    renderTab([])
    expect(screen.getByText('timeline.empty')).toBeInTheDocument()
    expect(screen.queryByTestId('timeline-dot')).toBeNull()
  })
})

// AI-ACT-1: an `ai` entry used to render only a bare KoiosAiMark icon with no
// visible text — replaced by the shared AiGeneratedLabel so the disclosure is
// icon+text, never colour/icon-only (§6).
describe('TimelineTab · AI-generated disclosure (AI-ACT-1)', () => {
  it('shows the AI-generated label on an ai-flagged event', () => {
    renderTab([event({ id: `note-${UUID}`, ai: true })])
    expect(screen.getByText('AI-gegenereerd')).toBeInTheDocument()
  })

  it('shows nothing extra on a human-authored event', () => {
    renderTab([event({ id: `note-${UUID}`, ai: false })])
    expect(screen.queryByText('AI-gegenereerd')).toBeNull()
  })
})

// Danny 05-08: raw ISO strings + isolated dots without a connecting line.
// Punt 17: the full stamp repeated on every row, and one primary dot for every
// kind of event regardless of what happened.
describe('TimelineTab · axis, day heading & time', () => {
  it('routes `time` through the house formatters — never the raw ISO field', () => {
    renderTab([event({ id: `note-${UUID}`, description: 'Klant gebeld', time: '2026-07-24T09:00:00+02:00' })])
    expect(screen.getByText('09:00')).toBeInTheDocument()
    expect(screen.getByText('DAY(2026-07-24)')).toBeInTheDocument()
    expect(screen.queryByText('2026-07-24T09:00:00+02:00')).toBeNull()
  })

  it('keeps the full moment on hover instead of on the row', () => {
    renderTab([event({ id: `note-${UUID}`, time: '2026-07-24T09:00:00+02:00' })])
    expect(screen.getByText('09:00')).toHaveAttribute('title', 'FULL(2026-07-24T09:00:00+02:00)')
  })

  it('draws no dangling connector after a single item', () => {
    renderTab([event({ id: `note-${UUID}` })])
    expect(screen.getByTestId('timeline-dot')).toBeInTheDocument()
    expect(screen.queryByTestId('timeline-connector')).toBeNull()
  })

  it('connects every item except the last', () => {
    renderTab([
      event({ id: 'note-1' }), event({ id: 'note-2' }), event({ id: 'note-3' }),
    ])
    expect(screen.getAllByTestId('timeline-dot')).toHaveLength(3)
    // One shared day → one heading that adds no segment: 3 items → 2 segments.
    expect(screen.getAllByTestId('timeline-connector')).toHaveLength(2)
  })

  it('gives each event kind its own marker colour — the real backend kinds', () => {
    // Verified live against GET /vacancies/{id}: these three are what ships today.
    renderTab([
      event({ id: 'vacancy_published-1', type: 'vacancy_published', description: 'Gepubliceerd', author: null as unknown as string }),
      event({ id: 'vacancy_created-1', type: 'vacancy_created', description: 'Vacature aangemaakt', time: '2026-07-23T08:00:00+02:00' }),
    ])
    const dots = screen.getAllByTestId('timeline-dot')
    expect(dots[0].getAttribute('style')).toMatch(/var\(--color-success\)/)
    expect(dots[1].getAttribute('style')).toMatch(/var\(--color-primary\)/)
  })

  it('carries the axis past a SECOND day heading, and never above the first', () => {
    renderTab([
      event({ id: 'note-1', time: '2026-07-24T09:00:00+02:00' }),
      event({ id: 'note-2', time: '2026-07-23T09:00:00+02:00' }),
    ])
    expect(screen.getAllByText(/^DAY\(/)).toHaveLength(2)
    // 2 markers → 1 inter-row segment, + 1 segment beside the second heading.
    expect(screen.getAllByTestId('timeline-connector')).toHaveLength(2)
  })
})
