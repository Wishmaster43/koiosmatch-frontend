/**
 * contactFieldValidation tests — pure logic, no React. Each check is asserted
 * against the exact shapes the backend rules accept/reject (Phone.php,
 * CandidateProfileRequest's linkedin_slug regex) so the FE never blocks a value
 * the API would accept, nor lets through one it would 422 on.
 */
import { describe, it, expect } from 'vitest'
import { isValidEmailFormat, isValidPhoneFormat, isValidLinkedinFormat } from './contactFieldValidation'

describe('isValidEmailFormat', () => {
  it('accepts empty (optional field, required-ness checked elsewhere)', () => {
    expect(isValidEmailFormat('')).toBe(true)
    expect(isValidEmailFormat('   ')).toBe(true)
  })
  it('accepts a well-formed address', () => {
    expect(isValidEmailFormat('jan@example.nl')).toBe(true)
  })
  it('rejects a value with no @ or no domain dot', () => {
    expect(isValidEmailFormat('jan.example.nl')).toBe(false)
    expect(isValidEmailFormat('jan@example')).toBe(false)
    expect(isValidEmailFormat('n.v.t.')).toBe(false)
  })
})

describe('isValidPhoneFormat (mirrors App\\Rules\\Phone)', () => {
  it('accepts empty', () => { expect(isValidPhoneFormat('')).toBe(true) })
  it('accepts an NL mobile number (10 digits)', () => {
    expect(isValidPhoneFormat('0612345678')).toBe(true)
  })
  it('accepts a +country number with separators', () => {
    expect(isValidPhoneFormat('+31 6 1234 5678')).toBe(true)
  })
  it('rejects free text (an e-mail typed into the phone field)', () => {
    expect(isValidPhoneFormat('piet@example.com')).toBe(false)
  })
  it('rejects too few digits (< 8)', () => {
    expect(isValidPhoneFormat('06-12')).toBe(false)
  })
  it('rejects too many digits (> 15)', () => {
    expect(isValidPhoneFormat('1234567890123456')).toBe(false)
  })
})

describe('isValidLinkedinFormat (mirrors CandidateProfileRequest linkedin_slug)', () => {
  it('accepts empty', () => { expect(isValidLinkedinFormat('')).toBe(true) })
  it('accepts a bare slug', () => { expect(isValidLinkedinFormat('jane-doe-12345')).toBe(true) })
  it('accepts a pasted full profile URL — normalised to its slug first', () => {
    expect(isValidLinkedinFormat('https://www.linkedin.com/in/jane-doe-12345/')).toBe(true)
  })
  it('rejects a value containing whitespace', () => {
    expect(isValidLinkedinFormat('jane doe')).toBe(false)
  })
})
