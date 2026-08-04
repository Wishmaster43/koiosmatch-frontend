/**
 * V21-23 — the vacancy timeline is CLICKABLE. Regression guard for the state
 * this replaced: the tab rendered every event as dead text, so "sollicitatie
 * ontvangen" / "match gemaakt" named a record the recruiter could not open.
 * Asserts the real navigation seam (which page + which id) and the new-tab
 * anchor's rel hardening, not merely that something rendered.
 *
 * `@/lib/datetime` is mocked (mirrors src/pages/*\/drawer/ChangelogTab.test.tsx):
 * TimelineTab now formats `time` via formatDateTime (Danny 05-08 — raw ISO was
 * rendering), and that hook transitively imports the real i18n bootstrap, which
 * would load REAL translations and break the literal-key assertions below
 * (`t('timeline.openApplication')` etc.) elsewhere in this file. The mock keeps
 * those i18n-key assertions intact; formatDateTime's own output is asserted for
 * real in datetime.test.ts, and the wiring (component calls it) below.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TimelineTab from './TimelineTab'
import { NavigationProvider } from '@/context/NavigationContext'
import type { VacancyDetail, VacancyTimelineEvent } from '@/types/vacancy'

// Distinguishable (not identity) transform: proves the component ROUTES `time`
// through formatDateTime rather than rendering the raw field directly.
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({
    formatDate: (v: string) => v,
    formatDateTime: (v?: string | null) => (v ? `FMT(${v})` : '—'),
    locale: 'nl-NL',
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
  })
})

// Danny 05-08: raw ISO strings + isolated dots without a connecting line, on
// this Tijdlijn tab specifically (screenshot was the applications one, but the
// same fix applies here too).
describe('TimelineTab · connector rail & date formatting', () => {
  it('routes `time` through formatDateTime — never the raw ISO field', () => {
    renderTab([event({ id: `note-${UUID}`, description: 'Klant gebeld', time: '2026-07-24T09:00:00+02:00' })])
    expect(screen.getByText('FMT(2026-07-24T09:00:00+02:00)')).toBeInTheDocument()
    expect(screen.queryByText('2026-07-24T09:00:00+02:00')).toBeNull()
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
    expect(screen.getAllByTestId('timeline-connector')).toHaveLength(2)
  })
})
