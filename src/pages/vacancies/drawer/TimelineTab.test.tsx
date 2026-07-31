/**
 * V21-23 — the vacancy timeline is CLICKABLE. Regression guard for the state
 * this replaced: the tab rendered every event as dead text, so "sollicitatie
 * ontvangen" / "match gemaakt" named a record the recruiter could not open.
 * Asserts the real navigation seam (which page + which id) and the new-tab
 * anchor's rel hardening, not merely that something rendered.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TimelineTab from './TimelineTab'
import { NavigationProvider } from '@/context/NavigationContext'
import type { VacancyDetail, VacancyTimelineEvent } from '@/types/vacancy'

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
