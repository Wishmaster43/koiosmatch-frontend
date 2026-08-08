/**
 * phoneNumber — the notation cases that decide whether the duplicate guard sees
 * one candidate or two. Measured contract (live API, 2026-08-08): the backend
 * compares the raw column value, so these three spellings MUST collapse to one
 * string before the create body leaves the browser.
 */
import { describe, it, expect } from 'vitest'
import { canonicalPhone, samePhone, sameEmail } from './phoneNumber'

describe('canonicalPhone', () => {
  it('collapses the three notations of one Dutch mobile onto a single string', () => {
    expect(canonicalPhone('+31612345678')).toBe('+31612345678')
    expect(canonicalPhone('0612345678')).toBe('+31612345678')
    expect(canonicalPhone('06-12345678')).toBe('+31612345678')
    expect(canonicalPhone('06 12 34 56 78')).toBe('+31612345678')
    expect(canonicalPhone('+31 (0)6 12345678')).toBe('+31612345678')
  })

  it('canonicalises a Dutch landline the same way', () => {
    expect(canonicalPhone('030-1234567')).toBe('+31301234567')
    expect(canonicalPhone('(030) 123 45 67')).toBe('+31301234567')
  })

  it('reads 00 as the international access code', () => {
    expect(canonicalPhone('0031612345678')).toBe('+31612345678')
    expect(canonicalPhone('0049171234567')).toBe('+49171234567')
  })

  it('keeps a foreign number in its own country code', () => {
    expect(canonicalPhone('+49 171 2345678')).toBe('+491712345678')
  })

  it('never invents a country code for an ambiguous value', () => {
    // No '+', no trunk '0' — could be German, could be Dutch-without-the-zero.
    expect(canonicalPhone('31612345678')).toBe('31612345678')
    expect(canonicalPhone('612345678')).toBe('612345678')
  })

  it('leaves a too-short or empty value exactly as typed', () => {
    expect(canonicalPhone('06-12')).toBe('06-12')
    expect(canonicalPhone('   ')).toBe('')
    expect(canonicalPhone('')).toBe('')
    expect(canonicalPhone(null)).toBe('')
    expect(canonicalPhone(undefined)).toBe('')
  })

  it('honours an explicit country code for a non-NL tenant', () => {
    expect(canonicalPhone('0171 2345678', '49')).toBe('+491712345678')
  })
})

describe('samePhone', () => {
  it('treats every notation of one number as the same line', () => {
    expect(samePhone('06-12345678', '+31612345678')).toBe(true)
    expect(samePhone('0612345678', '0031612345678')).toBe(true)
  })

  it('keeps two different numbers apart', () => {
    expect(samePhone('0612345678', '0612345679')).toBe(false)
  })

  it('never matches on an empty value', () => {
    expect(samePhone('', '')).toBe(false)
    expect(samePhone(null, '0612345678')).toBe(false)
  })
})

describe('sameEmail', () => {
  it('matches case-insensitively, like the server column does', () => {
    expect(sameEmail('Piet@Example.test', ' piet@example.test ')).toBe(true)
  })

  it('never matches on an empty value', () => {
    expect(sameEmail('', '')).toBe(false)
    expect(sameEmail(undefined, 'piet@example.test')).toBe(false)
  })
})
