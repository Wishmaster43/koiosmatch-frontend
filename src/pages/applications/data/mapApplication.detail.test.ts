/** mapApplication · detail mapping, notes and AI advice (split from mapApplication.test.ts; pure mapper tests). */
import { describe, it, expect } from 'vitest'
import { mapApplicationDetail } from './mapApplication'

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

  it('passes the delivery flags through, absent stays undefined', () => {
    const d = mapApplicationDetail({ id: 4, rejection: { reason_label: 'X', delivery_status: 'bounced', undelivered: true } })
    expect(d.rejection?.delivery_status).toBe('bounced')
    expect(d.rejection?.undelivered).toBe(true)
    expect(mapApplicationDetail({ id: 5, rejection: { reason_label: 'X' } }).rejection?.delivery_status).toBeUndefined()
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

  // INTERVIEW-VISIBILITY-1 (29-09): the vacancy's OWN default workflow, nested on
  // the application's `vacancy` block — a separate field from this application's
  // own `interview_workflow` override one level up.
  describe('vacancyInterviewWorkflow (INTERVIEW-VISIBILITY-1)', () => {
    it('maps the nested vacancy.interview_workflow when present', () => {
      const detail = mapApplicationDetail({
        id: 20,
        vacancy: { id: 'v-1', interview_workflow: { id: 'wf-1', name: 'Zorg workflow', agent: { id: 'a-1', name: 'Kelly' } } },
      })
      expect(detail.vacancyInterviewWorkflow).toEqual({ id: 'wf-1', name: 'Zorg workflow', agent: { id: 'a-1', name: 'Kelly' } })
    })

    it('is null when the vacancy explicitly has no default workflow', () => {
      expect(mapApplicationDetail({ id: 21, vacancy: { id: 'v-2', interview_workflow: null } }).vacancyInterviewWorkflow).toBeNull()
    })

    // Presence-gated (§3): the backend not sending the `interview_workflow` key
    // at all on the vacancy block is a DIFFERENT claim than an explicit null —
    // undefined must never be read as "the vacancy has none" downstream.
    it('is undefined (not null) when the vacancy block omits the interview_workflow key entirely', () => {
      expect(mapApplicationDetail({ id: 22, vacancy: { id: 'v-2' } }).vacancyInterviewWorkflow).toBeUndefined()
      expect(mapApplicationDetail({ id: 23 }).vacancyInterviewWorkflow).toBeUndefined()
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
