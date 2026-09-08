import { describe, it, expect } from 'vitest'
import { mapApplication, mapApplicationDetail, mapInterview, mapMatchSummary } from './mapApplication'
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
        id: null, agent: null, flowName: null, flowId: null, turn: null, startedAt: null, lastMessageAt: null, endedAt: null, durationSeconds: null,
        questionStepIndex: null, questionStepsTotal: 0, sessionScope: 'application',
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

  // B-46: the vacancy's customer_id, now available in the nested vacancy object.
  it('maps vacancy.customer_id to vacancy.customerId, null when absent', () => {
    expect(mapApplicationDetail({ id: 20, vacancy: { customer_id: 'cust-abc' } }).vacancy.customerId).toBe('cust-abc')
    expect(mapApplicationDetail({ id: 21, vacancy: {} }).vacancy.customerId).toBeNull()
    expect(mapApplicationDetail({ id: 22 }).vacancy.customerId).toBeNull()
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

  // INTERVIEW-CONSENT-PERSIST-1: the applicant's consent-tick timestamp, null-safe.
  describe('interviewConsentGivenAt (INTERVIEW-CONSENT-PERSIST-1)', () => {
    it('maps interview_consent_given_at to interviewConsentGivenAt', () => {
      expect(mapApplicationDetail({ id: 10, interview_consent_given_at: '2026-07-20T10:00:00Z' }).interviewConsentGivenAt)
        .toBe('2026-07-20T10:00:00Z')
    })

    it('defaults to null when interview_consent_given_at is absent', () => {
      expect(mapApplicationDetail({ id: 11 }).interviewConsentGivenAt).toBeNull()
    })

    it('defaults to null when interview_consent_given_at is explicitly null', () => {
      expect(mapApplicationDetail({ id: 12, interview_consent_given_at: null }).interviewConsentGivenAt).toBeNull()
    })
  })

  // CONTACT-PERSON-1: the vacancy's customer contact, derived by
  // ApplicationDetailResource::contact() from the linked vacancy's contact_id. These
  // pin the SEAM — the exact payload that resource emits — because the field was
  // untested at the mapper level while only the card's render was covered.
  describe('contact (CONTACT-PERSON-1)', () => {
    it('maps the resource payload {id,name,email,phone} onto the UI shape', () => {
      const detail = mapApplicationDetail({
        id: 13,
        contact: { id: 'ct-1', name: 'Marieke Jansen', email: 'marieke@zorggroep.nl', phone: '0612345678' },
      })
      expect(detail.contact).toEqual({ id: 'ct-1', name: 'Marieke Jansen', email: 'marieke@zorggroep.nl', phone: '0612345678' })
    })

    // customer_contacts.email/phone are nullable columns, so a REAL contact can arrive
    // with either missing — consumers gate on truthiness, which needs '' and not null.
    it("coerces a contact's nullable email/phone to empty strings", () => {
      const detail = mapApplicationDetail({ id: 14, contact: { id: 'ct-2', name: 'Piet Klaassen', email: null, phone: null } as never })
      expect(detail.contact).toEqual({ id: 'ct-2', name: 'Piet Klaassen', email: '', phone: '' })
    })

    it('defaults to null when the vacancy (or its contact_id) is absent', () => {
      expect(mapApplicationDetail({ id: 15 }).contact).toBeNull()
      expect(mapApplicationDetail({ id: 16, contact: null }).contact).toBeNull()
    })
  })

  // CONTACT-DERIVE-1 (CMBE 12:05): hasContactField is a PRESENCE gate, literally
  // whether the raw record carries the `contact` key — not whether it resolved to
  // a real contact. ApplicationDetailsCard uses this to skip its vacancy-cascade
  // fallback fetch entirely once a tenant is on the new contract, so the three
  // cases (present, explicitly null, absent) must map to three different reads.
  describe('hasContactField (CONTACT-DERIVE-1)', () => {
    it('is true when the raw record carries a real contact', () => {
      const detail = mapApplicationDetail({
        id: 17,
        contact: { id: 'ct-3', name: 'Marieke Jansen', email: 'marieke@zorggroep.nl', phone: '0612345678' },
      })
      expect(detail.hasContactField).toBe(true)
    })

    it('is STILL true when the key is explicitly null (the vacancy has no contact set) — a resolved absence, not a missing field', () => {
      expect(mapApplicationDetail({ id: 18, contact: null }).hasContactField).toBe(true)
    })

    it('is false when the key is absent entirely (a payload that predates the field)', () => {
      expect(mapApplicationDetail({ id: 19 }).hasContactField).toBe(false)
    })
  })

  // W7 (measured 07-08 in ApplicationDetailResource::interviews — APP-INTERVIEW-HISTORY-1):
  // the previous mapper read `channel`/`created_at`/`time`/`summary` and transcript
  // `author`/`side`/`time`/`text` — none of those exist on the resource. Pins the REAL
  // shape: status/started_at/finished_at, transcript direction/body/sent_at only.
  describe('interviews (W7 — the real APP-INTERVIEW-HISTORY-1 contract)', () => {
    it('maps status/started_at/finished_at and the transcript direction/body/sent_at', () => {
      const detail = mapApplicationDetail({
        id: 17,
        interviews: [{
          id: 'sess-1', status: 'completed', started_at: '2026-07-28T09:00:00Z', finished_at: '2026-08-01T11:30:00Z',
          transcript: [
            { direction: 'outbound', body: 'What is your availability?', sent_at: '2026-07-28T09:01:00Z' },
            { direction: 'inbound', body: 'I can start Monday.', sent_at: '2026-07-28T09:05:00Z' },
          ],
        }],
      })
      expect(detail.interviews).toEqual([{
        id: 'sess-1', status: 'completed', startedAt: '2026-07-28T09:00:00Z', finishedAt: '2026-08-01T11:30:00Z',
        transcript: [
          { direction: 'outbound', body: 'What is your availability?', sentAt: '2026-07-28T09:01:00Z' },
          { direction: 'inbound', body: 'I can start Monday.', sentAt: '2026-07-28T09:05:00Z' },
        ],
      }])
    })

    it('defaults to an empty array when the application never ran an interview', () => {
      expect(mapApplicationDetail({ id: 18 }).interviews).toEqual([])
      expect(mapApplicationDetail({ id: 19, interviews: [] }).interviews).toEqual([])
    })

    it('defaults status to empty string, timestamps to null and transcript to [] when the row is bare', () => {
      const detail = mapApplicationDetail({ id: 20, interviews: [{ id: 'sess-2' }] })
      expect(detail.interviews).toEqual([{ id: 'sess-2', status: '', startedAt: null, finishedAt: null, transcript: [] }])
    })

    it('defaults a bare transcript entry to empty body/direction and null sentAt', () => {
      const detail = mapApplicationDetail({ id: 21, interviews: [{ id: 'sess-3', transcript: [{}] }] })
      expect(detail.interviews[0].transcript).toEqual([{ direction: '', body: '', sentAt: null }])
    })

    it('maps a still-running session (no finished_at) with a running status', () => {
      const detail = mapApplicationDetail({
        id: 22,
        interviews: [{ id: 'sess-4', status: 'running', started_at: '2026-08-05T08:00:00Z', finished_at: null, transcript: [] }],
      })
      expect(detail.interviews).toEqual([{ id: 'sess-4', status: 'running', startedAt: '2026-08-05T08:00:00Z', finishedAt: null, transcript: [] }])
    })
  })
})

// W10 (verified live 07-08 against ApplicationDetailResource::applicationNotes()):
// `type`/`title`/`language` used to be dropped on the floor — a fetched note lost
// its type chip and spellcheck language even though the resource always sends them.
describe('mapApplicationDetail · notes (W10)', () => {
  it('maps type/title/language through, not just author/text/time', () => {
    const detail = mapApplicationDetail({
      id: 23,
      notes: [{
        id: 'n1', author: 'Bente de Jong', type: 'call', title: 'Belafspraak',
        text: 'Gebeld over intake', language: 'nl', created_at: '2026-08-06T10:00:00Z',
      }],
    })
    expect(detail.notes).toEqual([{
      id: 'n1', author: 'Bente de Jong', authorId: null, type: 'call', title: 'Belafspraak',
      text: 'Gebeld over intake', language: 'nl', time: '2026-08-06T10:00:00Z', hasPreviousVersion: false,
     action_items: null,}])
  })

  it('defaults type/title/language to empty strings when the resource omits them', () => {
    const detail = mapApplicationDetail({ id: 24, notes: [{ id: 'n2', author: 'Bente de Jong', text: 'Kort' }] })
    expect(detail.notes).toEqual([{ id: 'n2', author: 'Bente de Jong', authorId: null, type: '', title: '', text: 'Kort', language: '', time: '', hasPreviousVersion: false, action_items: null }])
  })

  // NOTE-UNDO-FE-1 (K-172): has_previous_version maps through to hasPreviousVersion.
  it('maps has_previous_version through to hasPreviousVersion', () => {
    const detail = mapApplicationDetail({ id: 26, notes: [{ id: 'n3', author: 'Bente de Jong', text: 'Kort', has_previous_version: true }] })
    expect(detail.notes[0].hasPreviousVersion).toBe(true)
  })

  it('defaults to an empty array when the application has no notes', () => {
    expect(mapApplicationDetail({ id: 25 }).notes).toEqual([])
  })

  // NOTE-AUTHOR-SHAPE-2 (verified live 2026-08-07, CMBE 5961c673): the resource now
  // sends `author_id` on every note (previously never emitted) — the mapper must
  // thread it through as `authorId`, the key the shared NotesTab's rights gate reads.
  it('maps author_id through to authorId (NOTE-AUTHOR-SHAPE-2)', () => {
    const detail = mapApplicationDetail({
      id: 26,
      notes: [{ id: 'n3', author: 'Kelly Recruiter', author_id: 'u9', text: 'Eigen notitie', created_at: '2026-08-07T09:00:00Z' }],
    })
    expect(detail.notes[0].authorId).toBe('u9')
  })
  // X-34b (CMBE 0b3ac963): action_items ride along on the wire key, null when the note has none.
  it('maps action_items through as-is (X-34b), null when absent', () => {
    const detail = mapApplicationDetail({ id: 25, notes: [
      { id: 'n3', author: 'Kelly', text: 'Met actie', action_items: [{ id: 'ai1', title: 'Bellen', type: 'reminder', status: 'pending' }] },
      { id: 'n4', author: 'Kelly', text: 'Zonder' },
    ] } as never)
    expect(detail.notes[0].action_items).toEqual([{ id: 'ai1', title: 'Bellen', type: 'reminder', status: 'pending' }])
    expect(detail.notes[1].action_items).toBeNull()
  })
})

// PLACEMENT-REMOVED-1 (verified live 2026-08-07, CMBE 5961c673): the deprecated
// `placement_*` alias (MATCH-VOCABULAIRE-1) is REMOVED from the Match block —
// ApplicationDetailResource::matchLink() only ever sends `match_start`/`match_end`
// now. The mapper's fallback read is pruned; this pins that a stray `placement_*`
// (e.g. an old cached payload) is never surfaced as if it were a real date.
describe('mapMatchSummary · match_start/match_end (PLACEMENT-REMOVED-1)', () => {
  it('maps the match_start/match_end pair', () => {
    const summary = mapMatchSummary({ id: 'm1', match_start: '2026-08-01', match_end: '2026-09-01' } as never)
    expect(summary).toMatchObject({ matchStart: '2026-08-01', matchEnd: '2026-09-01' })
  })

  it('ignores a stray deprecated placement_start/placement_end pair — it is no longer read', () => {
    const summary = mapMatchSummary({ id: 'm2', placement_start: '2026-08-01', placement_end: '2026-09-01' } as never)
    expect(summary).toMatchObject({ matchStart: null, matchEnd: null })
  })

  it('leaves both null when neither pair is present', () => {
    const summary = mapMatchSummary({ id: 'm3' } as never)
    expect(summary).toMatchObject({ matchStart: null, matchEnd: null })
  })
})

// Regression (30-07): the backend derives `turn` with a MIXED vocabulary — 'agent' and
// 'recruiter' in English next to 'kandidaat' and 'afgerond' in Dutch — while the chip looks
// up its label and colour by that value. The two Dutch ones rendered a raw i18n key with no
// colour. And `paused_by` arrives as a bare uuid with the name in `paused_by_name`, which
// the mapper read as an object, so "overgenomen door …" was permanently empty.
describe('mapInterview · the backend contract as it really is', () => {
  it("maps the Dutch turn values onto our own vocabulary", () => {
    expect(mapInterview({ turn: 'kandidaat' } as never)?.turn).toBe('candidate')
    expect(mapInterview({ turn: 'afgerond' } as never)?.turn).toBe('completed')
  })

  it('passes the English ones through untouched', () => {
    expect(mapInterview({ turn: 'agent' } as never)?.turn).toBe('agent')
    expect(mapInterview({ turn: 'recruiter' } as never)?.turn).toBe('recruiter')
  })

  it('reads paused_by as a bare uuid plus its separate display name', () => {
    const iv = mapInterview({ paused_by: 'u-1', paused_by_name: 'Kelly Yesway' } as never)
    expect(iv?.pausedBy).toEqual({ id: 'u-1', name: 'Kelly Yesway' })
  })

  it('still accepts a nested paused_by, in case the resource ever nests it', () => {
    const iv = mapInterview({ paused_by: { id: 'u-2', name: 'Tom Demo' } } as never)
    expect(iv?.pausedBy).toEqual({ id: 'u-2', name: 'Tom Demo' })
  })

  it('leaves pausedBy null when nobody took over', () => {
    expect(mapInterview({ turn: 'agent' } as never)?.pausedBy).toBeNull()
  })
})

// The exact body InterviewSessionResource::block() emits (measured 01-08), mapped in
// one go. It guards the two seams that were silently dead: `flow_name` (added by the
// backend — the drawer subtitle had nothing to render before) and the timing pair,
// which the mapper read under column names that do not exist.
describe('mapInterview · the real InterviewSessionResource payload', () => {
  const resourceBody = {
    id: 'sess-1',
    flow_id: 'flow-1',
    flow_name: 'Verpleegkundige intake',
    current_status: 'ACTIVE_IN_CARE',
    statuses: ['START', 'ACTIVE_IN_CARE', 'DONE'],
    step: 2,
    total: 3,
    collected: {},
    started_at: '2026-07-28T09:00:00Z',
    completed_at: '2026-08-01T11:30:00Z',
    last_sent_at: '2026-08-01T11:25:00Z',
    duration_seconds: 354600,
    turn: 'afgerond',
    disqualified_reason: null,
    paused_at: null,
    paused_by: null,
    paused_by_name: null,
    agent: { id: 'agent-1', name: 'Yesway Zorg-agent' },
  }

  it('maps every field of the resource body, including the flow name the card subtitles with', () => {
    expect(mapInterview(resourceBody as never)).toEqual({
      category: 'completed',
      currentStatus: 'ACTIVE_IN_CARE',
      step: 2,
      total: 3,
      id: 'sess-1',
      agent: { id: 'agent-1', name: 'Yesway Zorg-agent' },
      flowName: 'Verpleegkundige intake',
      flowId: 'flow-1',
      turn: 'completed',
      startedAt: '2026-07-28T09:00:00Z',
      lastMessageAt: '2026-08-01T11:25:00Z',
      endedAt: '2026-08-01T11:30:00Z',
      durationSeconds: 354600,
        questionStepIndex: null, questionStepsTotal: 0, sessionScope: 'application',
      pausedAt: null,
      pausedBy: null,
    })
  })

  // The list resource sends a strict subset: no agent, turn, started_at,
  // duration_seconds or pause metadata. Those must map to null, so no list surface
  // can accidentally present an empty value as a real one.
  it('maps the LIST subset without inventing the detail-only fields', () => {
    const listRow = {
      id: 'sess-1', category: 'busy', current_status: 'ACTIVE_IN_CARE', step: 2, total: 3,
      flow_name: 'Verpleegkundige intake', completed_at: null, last_sent_at: '2026-08-01T11:25:00Z',
    }
    expect(mapInterview(listRow as never)).toMatchObject({
      category: 'busy', flowName: 'Verpleegkundige intake', lastMessageAt: '2026-08-01T11:25:00Z',
      agent: null, turn: null, startedAt: null, durationSeconds: null, endedAt: null,
      pausedAt: null, pausedBy: null,
    })
  })
})

// S34 (02-09): the detail resource's `ai` advice block was emitted by the backend
// but dropped by the mapper, so the reject modal's Koios advice card never rendered.
describe('mapApplicationDetail · ai advice passthrough (S34)', () => {
  it('maps advice, advice_reason and auto_reject_eligible from the detail resource', () => {
    const d = mapApplicationDetail({ id: 1, ai: { advice: 'reject', advice_reason: 'Hard criterium niet gehaald: BIG.', auto_reject_eligible: true } })
    expect(d.ai).toEqual({ advice: 'reject', advice_reason: 'Hard criterium niet gehaald: BIG.', auto_reject_eligible: true })
  })

  it('collapses server nulls to undefined so the "advice === reject" gate stays honest', () => {
    const d = mapApplicationDetail({ id: 1, ai: { advice: null, advice_reason: null, auto_reject_eligible: false } })
    expect(d.ai).toEqual({ advice: undefined, advice_reason: undefined, auto_reject_eligible: false })
  })

  it('passes a known advice_reason_key + criterion through and drops an unknown key (DEMO-TAAL, CMBE 7f10f04c)', () => {
    const known = mapApplicationDetail({ id: 1, ai: { advice: 'reject', advice_reason: 'Hard criterium niet gehaald: BIG.', advice_reason_key: 'hard_fail', advice_reason_criterion: 'BIG', auto_reject_eligible: true } })
    expect(known.ai?.advice_reason_key).toBe('hard_fail')
    expect(known.ai?.advice_reason_criterion).toBe('BIG')
    const unknown = mapApplicationDetail({ id: 1, ai: { advice: 'reject', advice_reason: 'Iets nieuws.', advice_reason_key: 'brand_new', advice_reason_criterion: null } })
    expect(unknown.ai?.advice_reason_key).toBeUndefined()
    expect(unknown.ai?.advice_reason_criterion).toBeUndefined()
    expect(unknown.ai?.advice_reason).toBe('Iets nieuws.')
  })

  it('maps no advice block when the backend sends none or only the list-shaped task', () => {
    expect(mapApplicationDetail({ id: 1 }).ai).toBeUndefined()
    expect(mapApplicationDetail({ id: 1, ai: { task: 'Bel de kandidaat' } }).ai).toBeUndefined()
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

