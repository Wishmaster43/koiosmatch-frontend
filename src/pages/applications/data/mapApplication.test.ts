import { describe, it, expect } from 'vitest'
import { mapApplication, mapApplicationDetail } from './mapApplication'
import type { LookupItem } from '@/context/LookupsContext'

// A tenant that renamed the funnel: 'aangenomen' carries is_match — proves the
// mapped `bucket` is flag-driven, never the literal 'hired' slug (A1).
const RENAMED_FUNNEL: LookupItem[] = [
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  { value: 'aangenomen', label: 'Aangenomen', color: '#79B58E', is_match: true },
]

describe('mapApplication', () => {
  it('maps the owner id from a nested owner object', () => {
    expect(mapApplication({ id: 1, owner: { id: 'u7', name: 'Bente de Jong' } }).owner.id).toBe('u7')
  })

  it('falls back to owner_id when the owner object has none', () => {
    expect(mapApplication({ id: 2, owner_id: 'u9', owner_name: 'Kelly van Vliet' }).owner.id).toBe('u9')
  })

  it('leaves the owner id null when nothing is provided', () => {
    expect(mapApplication({ id: 3 }).owner.id).toBeNull()
  })

  it('derives owner initials from the first two words of the name', () => {
    expect(mapApplication({ id: 4, owner: { name: 'Bente de Jong' } }).owner.initials).toBe('BD')
  })

  it('falls back to a dash when no candidate name is present', () => {
    expect(mapApplication({ id: 5 }).candidateName).toBe('—')
  })

  it('derives the bucket off the funnel lookup flags, not a hardcoded phase key', () => {
    expect(mapApplication({ id: 6, phase_key: 'aangenomen' }, RENAMED_FUNNEL).bucket).toBe('matched')
    // Without a matching lookup entry, an unknown key is never assumed "matched".
    expect(mapApplication({ id: 7, phase_key: 'aangenomen' }).bucket).toBe('active')
  })

  // S12/13: ApplicationListResource sends the vacancy's client_id as customer_id.
  it('maps customer_id to customerId, null when absent', () => {
    expect(mapApplication({ id: 8, customer_id: 'cust1' }).customerId).toBe('cust1')
    expect(mapApplication({ id: 9 }).customerId).toBeNull()
  })

  // S5: the application's own display number (ApplicationListResource).
  it('maps reference_number to referenceNumber, empty string when absent', () => {
    expect(mapApplication({ id: 10, reference_number: 'S-00123' }).referenceNumber).toBe('S-00123')
    expect(mapApplication({ id: 11 }).referenceNumber).toBe('')
  })

  // APP-DELETED-AT-1: both the derived `archived` boolean and the raw `deleted_at`
  // timestamp now arrive for real — previously neither resource sent them at all.
  describe('archived / deleted_at (APP-DELETED-AT-1)', () => {
    it('maps archived + deletedAt from an explicit archived flag and deleted_at', () => {
      const mapped = mapApplication({ id: 12, archived: true, deleted_at: '2026-07-10T09:00:00Z' })
      expect(mapped.archived).toBe(true)
      expect(mapped.deletedAt).toBe('2026-07-10T09:00:00Z')
    })

    it('derives archived from deleted_at alone when the flag is absent', () => {
      expect(mapApplication({ id: 13, deleted_at: '2026-07-11T09:00:00Z' }).archived).toBe(true)
    })

    it('leaves archived false and deletedAt null for an active application', () => {
      const mapped = mapApplication({ id: 14 })
      expect(mapped.archived).toBe(false)
      expect(mapped.deletedAt).toBeNull()
    })
  })

  // INTERVIEW-PHASE-1: the live interview session's category + step progress.
  describe('interview (INTERVIEW-PHASE-1)', () => {
    it('maps null when the candidate has no interview session', () => {
      expect(mapApplication({ id: 15 }).interview).toBeNull()
      expect(mapApplication({ id: 16, interview: null }).interview).toBeNull()
    })

    it("passes through the list contract's explicit category + step/total", () => {
      const mapped = mapApplication({ id: 17, interview: { category: 'busy', current_status: 'ACTIVE_IN_CARE', step: 2, total: 12 } })
      expect(mapped.interview).toEqual({
        category: 'busy', currentStatus: 'ACTIVE_IN_CARE', step: 2, total: 12,
        id: null, agent: null, flowName: null, turn: null, startedAt: null, lastMessageAt: null, endedAt: null, durationSeconds: null,
        pausedAt: null, pausedBy: null,
      })
    })

    it('derives disqualified from disqualified_reason when the detail contract omits category', () => {
      const mapped = mapApplication({ id: 18, interview: { current_status: 'X', step: 3, total: 5, disqualified_reason: 'no_match' } })
      expect(mapped.interview?.category).toBe('disqualified')
    })

    it('derives completed from completed_at when the detail contract omits category', () => {
      const mapped = mapApplication({ id: 19, interview: { current_status: 'X', step: 5, total: 5, completed_at: '2026-07-20T09:00:00Z' } })
      expect(mapped.interview?.category).toBe('completed')
    })

    it('defaults to busy when neither category nor completed_at/disqualified_reason are present', () => {
      const mapped = mapApplication({ id: 20, interview: { current_status: 'X', step: 1, total: 5 } })
      expect(mapped.interview?.category).toBe('busy')
    })

    it('defaults total to 0 and step/currentStatus to null when absent', () => {
      const mapped = mapApplication({ id: 21, interview: { category: 'busy' } })
      expect(mapped.interview).toEqual({
        category: 'busy', currentStatus: null, step: null, total: 0,
        id: null, agent: null, flowName: null, turn: null, startedAt: null, lastMessageAt: null, endedAt: null, durationSeconds: null,
        pausedAt: null, pausedBy: null,
      })
    })
  })

  // INTERVIEW-STOP-1 (Danny 22-07): the `paused` category + who/when paused it.
  describe('interview paused (INTERVIEW-STOP-1)', () => {
    it('passes through an explicit paused category with paused_at/paused_by', () => {
      const mapped = mapApplication({
        id: 27,
        interview: { category: 'paused', paused_at: '2026-07-22T10:00:00Z', paused_by: { id: 'u1', name: 'Bente de Jong' } },
      })
      expect(mapped.interview?.category).toBe('paused')
      expect(mapped.interview?.pausedAt).toBe('2026-07-22T10:00:00Z')
      expect(mapped.interview?.pausedBy).toEqual({ id: 'u1', name: 'Bente de Jong' })
    })

    it('derives paused from paused_at alone when the category field is omitted', () => {
      const mapped = mapApplication({ id: 28, interview: { paused_at: '2026-07-22T10:00:00Z' } })
      expect(mapped.interview?.category).toBe('paused')
    })

    it('leaves pausedAt/pausedBy null when absent, and pausedBy null when its id is missing', () => {
      const mapped = mapApplication({ id: 29, interview: { category: 'busy', paused_by: { name: 'No id' } } })
      expect(mapped.interview?.pausedAt).toBeNull()
      expect(mapped.interview?.pausedBy).toBeNull()
    })
  })

  // INTERVIEW-VISIBILITY-1 (speculative — awaiting CMBE's confirmed contract):
  // agent/flow/turn/timing map defensively off the PROPOSED raw field names;
  // none of them exist on today's real payload, so absence must stay null,
  // never a crash or a synthetic placeholder value.
  describe('interview visibility fields (INTERVIEW-VISIBILITY-1, speculative)', () => {
    it('maps the session id, agent identity, flow name and turn when present', () => {
      const mapped = mapApplication({
        id: 22,
        interview: {
          id: 'iv-1', category: 'busy', step: 1, total: 3,
          agent: { id: 'a-1', name: 'Koios Verpleegkundige-agent' },
          flow_name: 'Verpleegkundige intake', turn: 'agent',
        },
      })
      expect(mapped.interview?.id).toBe('iv-1')
      expect(mapped.interview?.agent).toEqual({ id: 'a-1', name: 'Koios Verpleegkundige-agent' })
      expect(mapped.interview?.flowName).toBe('Verpleegkundige intake')
      expect(mapped.interview?.turn).toBe('agent')
    })

    it('leaves agent null when the raw agent object has no id', () => {
      const mapped = mapApplication({ id: 23, interview: { category: 'busy', agent: { name: 'No id' } } })
      expect(mapped.interview?.agent).toBeNull()
    })

    it('maps explicit duration_seconds directly', () => {
      const mapped = mapApplication({ id: 24, interview: { category: 'completed', duration_seconds: 720 } })
      expect(mapped.interview?.durationSeconds).toBe(720)
    })

    it('maps started_at/last_message_at/ended_at, defaulting all timing to null when absent', () => {
      const withTiming = mapApplication({
        id: 25,
        interview: { category: 'busy', started_at: '2026-07-21T09:00:00Z', last_message_at: '2026-07-21T09:10:00Z', ended_at: '2026-07-21T09:12:00Z' },
      })
      expect(withTiming.interview).toMatchObject({
        startedAt: '2026-07-21T09:00:00Z', lastMessageAt: '2026-07-21T09:10:00Z', endedAt: '2026-07-21T09:12:00Z',
      })
      const bare = mapApplication({ id: 26, interview: { category: 'busy' } })
      expect(bare.interview).toMatchObject({ startedAt: null, lastMessageAt: null, endedAt: null, durationSeconds: null, id: null, turn: null, flowName: null, agent: null })
    })
  })
})

describe('mapApplicationDetail', () => {
  // S9 finding: `rejection` was NEVER read off the raw payload, so a rejected
  // application's reason/toelichting silently vanished even though
  // ApplicationDetailResource sends it.
  it('maps the rejection trail (reason_label + note) from the raw payload', () => {
    const detail = mapApplicationDetail({
      id: 1,
      rejection: { reason_id: 'r1', reason_label: 'Niet gekwalificeerd', note: 'Geen ervaring', channel: 'email' },
    })
    expect(detail.rejection?.reason_label).toBe('Niet gekwalificeerd')
    expect(detail.rejection?.note).toBe('Geen ervaring')
  })

  it('leaves rejection undefined (never null) when the application was never rejected', () => {
    expect(mapApplicationDetail({ id: 2, rejection: null }).rejection).toBeUndefined()
    expect(mapApplicationDetail({ id: 3 }).rejection).toBeUndefined()
  })

  // S6 finding: the vacancy embed sends `city` (location_city), not a `location`
  // string — Locatie on the Sollicitatie tab was always blank without this fallback.
  it('falls back to the vacancy city when no location string is sent', () => {
    expect(mapApplicationDetail({ id: 4, vacancy: { city: 'Rotterdam' } }).vacancy.location).toBe('Rotterdam')
  })

  it('prefers an explicit vacancy location string over the city fallback', () => {
    expect(mapApplicationDetail({ id: 5, vacancy: { location: 'Zuid-Holland', city: 'Rotterdam' } }).vacancy.location).toBe('Zuid-Holland')
  })

  it('dashes to empty when neither location nor city is present', () => {
    expect(mapApplicationDetail({ id: 6 }).vacancy.location).toBe('')
  })

  // MOTIVATIE-ZICHTBAAR-1: the careersite apply's motivation letter, null-safe
  // until CMBE ships `cover_letter` on the detail resource.
  describe('coverLetter (MOTIVATIE-ZICHTBAAR-1)', () => {
    it('maps cover_letter to coverLetter', () => {
      expect(mapApplicationDetail({ id: 7, cover_letter: '<p>Ik solliciteer graag…</p>' }).coverLetter).toBe('<p>Ik solliciteer graag…</p>')
    })

    it('defaults to null when cover_letter is absent', () => {
      expect(mapApplicationDetail({ id: 8 }).coverLetter).toBeNull()
    })

    it('defaults to null when cover_letter is explicitly null', () => {
      expect(mapApplicationDetail({ id: 9, cover_letter: null }).coverLetter).toBeNull()
    })
  })
})
