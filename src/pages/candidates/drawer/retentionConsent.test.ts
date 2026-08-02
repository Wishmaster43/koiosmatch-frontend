/**
 * retentionConsent — the AVG rule the UI must never contradict (Danny 2026-08-02):
 * a retention consent LAPSES after the tenant's `retention_consent_months` window,
 * 0 means the tenant deliberately wants it to never expire, and a consent without a
 * provenance stamp counts as expired. Every branch here is measured against
 * CandidateRetentionPolicy (expiresAt / excludeValidConsent / consentMonths).
 */
import { describe, it, expect } from 'vitest'
import {
  addMonths, readConsentMonths, resolveRetentionConsent,
  DEFAULT_RETENTION_CONSENT_MONTHS, RETENTION_CONSENT_MONTHS_KEY,
} from './retentionConsent'

const NOW = new Date('2026-08-02T12:00:00Z')

describe('readConsentMonths — tenant setting coercion (Laravel serialises settings as strings)', () => {
  it('falls back to the backend default when the tenant never set the key', () => {
    expect(readConsentMonths({ other_setting: '1' })).toBe(DEFAULT_RETENTION_CONSENT_MONTHS)
    expect(DEFAULT_RETENTION_CONSENT_MONTHS).toBe(24) // mirrors CandidateRetentionPolicy::DEFAULT_CONSENT_MONTHS
  })

  it('reads the STRING value Laravel returns', () => {
    expect(readConsentMonths({ [RETENTION_CONSENT_MONTHS_KEY]: '36' })).toBe(36)
  })

  it('reads a numeric value too (tolerant by contract, §10)', () => {
    expect(readConsentMonths({ [RETENTION_CONSENT_MONTHS_KEY]: 36 })).toBe(36)
  })

  it('keeps 0 as 0 — it is a deliberate choice, never floored to 1 like the placement windows', () => {
    expect(readConsentMonths({ [RETENTION_CONSENT_MONTHS_KEY]: '0' })).toBe(0)
  })

  it('floors a negative to 0, mirroring the backend max(0, (int) $value)', () => {
    expect(readConsentMonths({ [RETENTION_CONSENT_MONTHS_KEY]: '-5' })).toBe(0)
  })

  it('treats an empty or unparseable value as "not set" → the backend default', () => {
    expect(readConsentMonths({ [RETENTION_CONSENT_MONTHS_KEY]: '' })).toBe(DEFAULT_RETENTION_CONSENT_MONTHS)
    expect(readConsentMonths({ [RETENTION_CONSENT_MONTHS_KEY]: 'abc' })).toBe(DEFAULT_RETENTION_CONSENT_MONTHS)
  })

  it('returns null (unresolved) for a payload that is not a settings map', () => {
    expect(readConsentMonths(null)).toBeNull()
    expect(readConsentMonths('<html>')).toBeNull()
  })
})

describe('addMonths — PHP/Carbon addMonths OVERFLOW parity', () => {
  it('overflows a short month exactly like Carbon (31-01 + 1 month = 03-03)', () => {
    expect(addMonths(new Date('2026-01-31T00:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2026-03-03')
  })

  it('adds whole months across a year boundary', () => {
    expect(addMonths(new Date('2026-01-15T00:00:00Z'), 24).toISOString().slice(0, 10)).toBe('2028-01-15')
  })
})

describe('resolveRetentionConsent — what the consent is worth right now', () => {
  it('no opt-in → "none", even when a historical consent date is still stored', () => {
    // The backend keeps retention_consent_at as evidence after the flag is cleared;
    // it protects nothing, so it must never render as validity.
    expect(resolveRetentionConsent({ optIn: false, consentAt: '2026-01-15T10:00:00Z', months: 24, now: NOW }))
      .toEqual({ kind: 'none' })
  })

  it('window not resolved → "unknownWindow", never a guessed date', () => {
    expect(resolveRetentionConsent({ optIn: true, consentAt: '2026-01-15T10:00:00Z', months: null, now: NOW }))
      .toEqual({ kind: 'unknownWindow' })
  })

  it('months = 0 → "indefinite" (the tenant deliberately wants consent to never expire)', () => {
    expect(resolveRetentionConsent({ optIn: true, consentAt: '2020-01-15T10:00:00Z', months: 0, now: NOW }))
      .toEqual({ kind: 'indefinite' })
  })

  it('consent without a provenance stamp → "undated": the backend cannot prove it current, so it counts as expired', () => {
    expect(resolveRetentionConsent({ optIn: true, consentAt: null, months: 24, now: NOW }))
      .toEqual({ kind: 'undated' })
  })

  it('an unparseable stamp is treated the same as a missing one', () => {
    expect(resolveRetentionConsent({ optIn: true, consentAt: 'not-a-date', months: 24, now: NOW }))
      .toEqual({ kind: 'undated' })
  })

  it('consent inside its window → "valid" until stamp + months', () => {
    const state = resolveRetentionConsent({ optIn: true, consentAt: '2026-01-15T10:00:00Z', months: 24, now: NOW })
    expect(state.kind).toBe('valid')
    expect(state.kind === 'valid' && state.until.toISOString().slice(0, 10)).toBe('2028-01-15')
  })

  it('consent past its window → "lapsed" since stamp + months (the checkbox is no longer the truth)', () => {
    const state = resolveRetentionConsent({ optIn: true, consentAt: '2023-01-15T10:00:00Z', months: 24, now: NOW })
    expect(state.kind).toBe('lapsed')
    expect(state.kind === 'lapsed' && state.since.toISOString().slice(0, 10)).toBe('2025-01-15')
  })

  it('exactly ON the lapse moment counts as lapsed, not as valid', () => {
    const consentAt = '2024-08-02T12:00:00Z' // + 24 months = NOW
    expect(resolveRetentionConsent({ optIn: true, consentAt, months: 24, now: NOW }).kind).toBe('lapsed')
  })

  it('a shorter tenant window lapses sooner — the window is never hardcoded to 24', () => {
    expect(resolveRetentionConsent({ optIn: true, consentAt: '2026-01-15T10:00:00Z', months: 3, now: NOW }).kind).toBe('lapsed')
  })
})
