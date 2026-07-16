import { describe, it, expect } from 'vitest'
import { waDigits } from './ProfileTab'

// Job 29 (2026-07-16): the wa.me link needs bare E.164 digits — covers the two
// phone shapes seen in the candidate dataset (with/without the +31 country code)
// plus the "too short to be real" guard that keeps a corrupted value from
// rendering a dead WhatsApp link.
describe('waDigits', () => {
  it('keeps an already-international number as-is (just strips formatting)', () => {
    expect(waDigits('+31 6 78308059')).toBe('31678308059')
  })

  it('turns a Dutch national leading 0 into the 31 country code', () => {
    expect(waDigits('06 78308059')).toBe('31678308059')
  })

  it('returns empty for a value too short to be a real MSISDN', () => {
    expect(waDigits('0612')).toBe('')
    expect(waDigits('-')).toBe('')
  })
})
