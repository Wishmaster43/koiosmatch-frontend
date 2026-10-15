import { describe, it, expect } from 'vitest'
import { isConsentState, readPrivacyNotice } from './consent'

describe('consent types', () => {
  it('accepts only the four states', () => {
    for (const s of ['granted', 'refused', 'not_asked', 'unconfirmed']) expect(isConsentState(s)).toBe(true)
    expect(isConsentState('maybe')).toBe(false)
    expect(isConsentState(null)).toBe(false)
  })
  it('treats a non-object block and a non-boolean due as "the BE did not say"', () => {
    expect(readPrivacyNotice('2026-10-01T00:00:00Z')).toEqual({ sentAt: null, due: null })
    expect(readPrivacyNotice(42)).toEqual({ sentAt: null, due: null })
    expect(readPrivacyNotice({ sent_at: '2026-10-01T00:00:00Z', due: 'true' })).toEqual({ sentAt: '2026-10-01T00:00:00Z', due: null })
  })

  it('reads the privacy notice tolerantly', () => {
    expect(readPrivacyNotice(undefined)).toEqual({ sentAt: null, due: null })
    expect(readPrivacyNotice({ sent_at: '2026-10-01T10:00:00+00:00', due: false })).toEqual({ sentAt: '2026-10-01T10:00:00+00:00', due: false })
    expect(readPrivacyNotice({ sent_at: null, due: true })).toEqual({ sentAt: null, due: true })
  })
})
