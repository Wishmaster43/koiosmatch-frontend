/**
 * mapCandidate — KEY-ADOPTION test: the mapper reads _key fields from the API
 * and maps them to camelCase twins on the Candidate model.
 */
import { describe, it, expect } from 'vitest'
import { mapCandidate } from './mapCandidate'
import type { ApiCandidate } from '@/types/candidate'

describe('mapCandidate · KEY-ADOPTION', () => {
  it('reads nationality_key and maps it to nationalityKey', () => {
    const api: ApiCandidate = {
      id: '1',
      nationality: 'Nederlands',
      nationality_key: 'nl_NL',
    }
    const candidate = mapCandidate(api)
    expect(candidate.nationality).toBe('Nederlands')
    expect(candidate.nationalityKey).toBe('nl_NL')
  })

  it('reads source_key and maps it to sourceKey', () => {
    const api: ApiCandidate = {
      id: '1',
      source: 'Indeed',
      source_key: 'indeed',
    }
    const candidate = mapCandidate(api)
    expect(candidate.source).toBe('Indeed')
    expect(candidate.sourceKey).toBe('indeed')
  })

  it('reads blacklist_reason_key and maps it to blacklistReasonKey', () => {
    const api: ApiCandidate = {
      id: '1',
      blacklist_reason: 'Non-compliant',
      blacklist_reason_key: 'non_compliant',
    }
    const candidate = mapCandidate(api)
    expect(candidate.blacklistReason).toBe('Non-compliant')
    expect(candidate.blacklistReasonKey).toBe('non_compliant')
  })

  it('sets _key fields to null when absent from the API', () => {
    const api: ApiCandidate = {
      id: '1',
      nationality: 'Nederlands',
      source: 'Indeed',
      blacklist_reason: null,
    }
    const candidate = mapCandidate(api)
    expect(candidate.nationalityKey).toBe(null)
    expect(candidate.sourceKey).toBe(null)
    expect(candidate.blacklistReasonKey).toBe(null)
  })

  it('handles all three _key fields together', () => {
    const api: ApiCandidate = {
      id: '1',
      nationality: 'Nederlands',
      nationality_key: 'nl_NL',
      source: 'Indeed',
      source_key: 'indeed',
      blacklist_reason: 'Non-compliant',
      blacklist_reason_key: 'non_compliant',
    }
    const candidate = mapCandidate(api)
    expect(candidate.nationality).toBe('Nederlands')
    expect(candidate.nationalityKey).toBe('nl_NL')
    expect(candidate.source).toBe('Indeed')
    expect(candidate.sourceKey).toBe('indeed')
    expect(candidate.blacklistReason).toBe('Non-compliant')
    expect(candidate.blacklistReasonKey).toBe('non_compliant')
  })
})

describe('mapCandidate · consent states and privacy notice (K-008)', () => {
  it('maps the three states verbatim and the notice passthrough', () => {
    const c = mapCandidate({
      id: '1',
      consent: { whatsapp_consent_state: 'granted', email_consent_state: 'unconfirmed', newsletter_consent_state: 'not_asked' },
      privacy_notice_sent_at: '2026-10-01T10:00:00+00:00',
      privacy_notice: { sent_at: '2026-10-01T10:00:00+00:00', due: false },
    } as ApiCandidate)
    expect(c.consent.whatsappConsentState).toBe('granted')
    expect(c.consent.emailConsentState).toBe('unconfirmed')
    expect(c.consent.newsletterConsentState).toBe('not_asked')
    expect(c.privacyNoticeSentAt).toBe('2026-10-01T10:00:00+00:00')
    expect(c.privacyNotice).toEqual({ sentAt: '2026-10-01T10:00:00+00:00', due: false })
  })
  it('reads an unknown state as null and passes due=true', () => {
    const c = mapCandidate({ id: '1', consent: { whatsapp_consent_state: 'bogus' }, privacy_notice: { sent_at: null, due: true } } as ApiCandidate)
    expect(c.consent.whatsappConsentState).toBeNull()
    expect(c.privacyNotice).toEqual({ sentAt: null, due: true })
  })
  it('absent blocks give nulls', () => {
    const c = mapCandidate({ id: '1' } as ApiCandidate)
    expect(c.consent.emailConsentState).toBeNull()
    expect(c.privacyNoticeSentAt).toBeNull()
    expect(c.privacyNotice).toEqual({ sentAt: null, due: null })
  })
})
