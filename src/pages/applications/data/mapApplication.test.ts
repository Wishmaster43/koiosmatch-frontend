import { describe, it, expect } from 'vitest'
import { mapApplication, mapApplicationDetail } from './mapApplication'
import { RENAMED_FUNNEL } from './mapApplication.testKit'

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

  // V-appdetail-1: mirrors CandidateResource's own missing_appointment flag.
  it('maps missing_appointment to missingAppointment, tolerant/false when absent', () => {
    expect(mapApplication({ id: 8, missing_appointment: true }).missingAppointment).toBe(true)
    expect(mapApplication({ id: 9 }).missingAppointment).toBe(false)
  })

  // PLACED-1 (2026-08-14, backend commit 9ba44e54): batched EXISTS on `matches`,
  // tolerant/false when the field is absent (older cached payloads).
  it('maps has_match to hasMatch, tolerant/false when absent', () => {
    expect(mapApplication({ id: 10, has_match: true }).hasMatch).toBe(true)
    expect(mapApplication({ id: 11, has_match: false }).hasMatch).toBe(false)
    expect(mapApplication({ id: 12 }).hasMatch).toBe(false)
  })

  // S12/13: ApplicationListResource sends the vacancy's client_id as customer_id.
  it('maps customer_id to customerId, null when absent', () => {
    expect(mapApplication({ id: 8, customer_id: 'cust1' }).customerId).toBe('cust1')
    expect(mapApplication({ id: 9 }).customerId).toBeNull()
  })

  // S6 (bundle F, CMBE 685ce339): customer_location/customer_department now
  // arrive directly on the application resource ({id, name}), null-safe.
  it('maps customer_location/customer_department to customerLocation/customerDepartment, null when absent', () => {
    const mapped = mapApplication({
      id: 13,
      customer_location: { id: 'loc1', name: 'Rivas Zorggroep — Den Haag' },
      customer_department: { id: 'dep1', name: 'Dagbesteding' },
    })
    expect(mapped.customerLocation).toEqual({ id: 'loc1', name: 'Rivas Zorggroep — Den Haag' })
    expect(mapped.customerDepartment).toEqual({ id: 'dep1', name: 'Dagbesteding' })

    const empty = mapApplication({ id: 14, customer_location: null, customer_department: null })
    expect(empty.customerLocation).toBeNull()
    expect(empty.customerDepartment).toBeNull()

    // Absent entirely (older cached payload) reads the same as explicit null.
    expect(mapApplication({ id: 15 }).customerLocation).toBeNull()
    expect(mapApplication({ id: 15 }).customerDepartment).toBeNull()
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
        id: null, agent: null, flowName: null, flowId: null, turn: null, startedAt: null, lastMessageAt: null, endedAt: null, durationSeconds: null,
        questionStepIndex: null, questionStepsTotal: 0, sessionScope: 'application',
        pausedAt: null, pausedBy: null, waitingSince: null,
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
        id: null, agent: null, flowName: null, flowId: null, turn: null, startedAt: null, lastMessageAt: null, endedAt: null, durationSeconds: null,
        questionStepIndex: null, questionStepsTotal: 0, sessionScope: 'application',
        pausedAt: null, pausedBy: null, waitingSince: null,
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

  // INTERVIEW-VISIBILITY-1 is LIVE (measured 01-08 in InterviewSessionResource):
  // agent/flow_name/turn/timing are really sent, off REAL column names. Absence
  // still maps to null — the list resource sends a subset — but the field names
  // below are the resource's, not a guess.
  describe('interview visibility fields (INTERVIEW-VISIBILITY-1)', () => {
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

    // The columns are `started_at`, `last_sent_at` and `completed_at`. There is no
    // `last_message_at`/`ended_at` column and the backend never sent either, so
    // mapping those two spellings left lastMessageAt/endedAt permanently null.
    it('reads lastMessageAt from last_sent_at and endedAt from completed_at', () => {
      const withTiming = mapApplication({
        id: 25,
        interview: { category: 'busy', started_at: '2026-07-21T09:00:00Z', last_sent_at: '2026-07-21T09:10:00Z', completed_at: '2026-07-21T09:12:00Z' },
      })
      expect(withTiming.interview).toMatchObject({
        startedAt: '2026-07-21T09:00:00Z', lastMessageAt: '2026-07-21T09:10:00Z', endedAt: '2026-07-21T09:12:00Z',
      })
      const bare = mapApplication({ id: 26, interview: { category: 'busy' } })
      expect(bare.interview).toMatchObject({ startedAt: null, lastMessageAt: null, endedAt: null, durationSeconds: null, id: null, turn: null, flowName: null, agent: null })
    })

    // INTERVIEW-VISIBILITY-1 (29-09): the newer `last_message_at`/`waiting_since`
    // spellings, tolerated on BOTH list and detail — `last_message_at` wins over
    // the older `last_sent_at` column when both are present.
    it('prefers last_message_at over last_sent_at when both are present', () => {
      const mapped = mapApplication({
        id: 30,
        interview: { category: 'busy', last_message_at: '2026-09-29T09:00:00Z', last_sent_at: '2026-09-29T08:00:00Z' },
      })
      expect(mapped.interview?.lastMessageAt).toBe('2026-09-29T09:00:00Z')
    })

    it('maps waiting_since, absent → null (never fabricated)', () => {
      const withWaiting = mapApplication({ id: 31, interview: { category: 'busy', turn: 'candidate', waiting_since: '2026-09-29T09:00:00Z' } })
      expect(withWaiting.interview?.waitingSince).toBe('2026-09-29T09:00:00Z')
      const bare = mapApplication({ id: 32, interview: { category: 'busy' } })
      expect(bare.interview?.waitingSince).toBeNull()
    })
  })
})

// S1 K-266/K-267: the new koios_ai_advice cache — a SEPARATE key from `ai`/`task` above.
describe('mapApplication / mapApplicationDetail · koiosAiAdvice', () => {
  it('maps the full detail block', () => {
    const r = mapApplicationDetail({
      id: 1,
      koios_ai_advice: { verdict: 'proceed', score: 88, text: 'Strong fit.', language: 'nl', generated_at: '2026-09-01T09:00:00Z', run_id: 'run-9' },
    })
    expect(r.koiosAiAdvice).toEqual({
      verdict: 'proceed', score: 88, text: 'Strong fit.', language: 'nl', generatedAt: '2026-09-01T09:00:00Z', runId: 'run-9',
    })
  })
  it('maps a compact list row', () => {
    expect(mapApplication({ id: 1, koios_ai_advice: { verdict: 'review', score: 55 } }).koiosAiAdvice)
      .toEqual({ verdict: 'review', score: 55, text: null, language: null, generatedAt: null, runId: null })
  })
  it('stays null on an explicit null and on an absent key', () => {
    expect(mapApplication({ id: 1, koios_ai_advice: null }).koiosAiAdvice).toBeNull()
    expect(mapApplication({ id: 1 }).koiosAiAdvice).toBeNull()
  })
})

// APP-CV-AUTOMATION-1: has_cv rides the list row and the detail as a plain boolean.
describe('mapApplication · hasCv', () => {
  it('maps has_cv and defaults to false', () => {
    expect(mapApplication({ id: 'a1', has_cv: true } as never).hasCv).toBe(true)
    expect(mapApplication({ id: 'a2' } as never).hasCv).toBe(false)
  })
})
