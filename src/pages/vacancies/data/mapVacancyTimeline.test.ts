/**
 * V21-23 — the vacancy timeline's link resolution. The backend
 * (app/Services/Vacancy/VacancyTimeline.php) emits COMPOSITE event ids
 * (`note-<uuid>` / `application-<uuid>` / `match-<uuid>`) and no explicit link
 * target, so the frontend has to split them. Guards the two ways that goes
 * wrong: splitting on the first dash (UUIDs contain dashes → a truncated id
 * that 404s) and inventing a link for an event kind that has no record page.
 */
import { describe, it, expect } from 'vitest'
import { mapVacancyDetail, resolveTimelineLink } from './mapVacancy'

const UUID = '9f1c2b3d-4e5f-6071-8293-a4b5c6d7e8f9'

describe('resolveTimelineLink', () => {
  it('points an application event at the applications page with the BARE uuid', () => {
    expect(resolveTimelineLink('application', `application-${UUID}`))
      .toEqual({ linkPage: 'applications', linkId: UUID })
  })

  it('points a match event at the matches page with the BARE uuid', () => {
    expect(resolveTimelineLink('match', `match-${UUID}`))
      .toEqual({ linkPage: 'matches', linkId: UUID })
  })

  it('leaves a note event unlinked — notes have no own record page', () => {
    expect(resolveTimelineLink('note', `note-${UUID}`))
      .toEqual({ linkPage: null, linkId: null })
  })

  it('falls back to the id prefix when the backend omits `type`', () => {
    expect(resolveTimelineLink('', `match-${UUID}`))
      .toEqual({ linkPage: 'matches', linkId: UUID })
  })

  it('returns no link for an unknown kind or a bare uuid', () => {
    expect(resolveTimelineLink('appointment', `appointment-${UUID}`)).toEqual({ linkPage: null, linkId: null })
    expect(resolveTimelineLink('', UUID)).toEqual({ linkPage: null, linkId: null })
  })

  it('returns no link when the composite id carries no id part', () => {
    expect(resolveTimelineLink('application', 'application-')).toEqual({ linkPage: null, linkId: null })
  })
})

describe('mapVacancyDetail timeline', () => {
  it('carries the event type and the resolved link onto every mapped event', () => {
    const detail = mapVacancyDetail({
      id: 'v-1',
      timeline: [
        { id: `application-${UUID}`, type: 'application', author: 'Jan Jansen', description: 'Sollicitatie ontvangen', created_at: '2026-07-24T09:00:00+02:00' },
        { id: `note-${UUID}`, type: 'note', author: 'Danny Polak', description: 'Klant gebeld', created_at: '2026-07-23T09:00:00+02:00' },
      ],
    })

    expect(detail.timeline[0]).toMatchObject({
      type: 'application', author: 'Jan Jansen', linkPage: 'applications', linkId: UUID,
    })
    expect(detail.timeline[1]).toMatchObject({ type: 'note', linkPage: null, linkId: null })
  })
})
