/**
 * companyIdentifiers — per-country KvK/BTW rules (Danny 08-08, points 10 + 11).
 *
 * Every supported country gets a VALID and an INVALID sample for both
 * identifiers, because the whole point of the change is that "8 digits" is only
 * the Dutch answer: a Belgian/German/French number that used to be refused must
 * now pass, and a Dutch number must NOT pass as Belgian.
 */
import { describe, it, expect } from 'vitest'
import {
  checkIdentifier, identifierSeverity, normalizeIdentifier, resolveCountryCode,
  parseIdentifierValidationMode, identifierExample, SUPPORTED_IDENTIFIER_COUNTRIES,
  DEFAULT_IDENTIFIER_VALIDATION_MODE,
} from './companyIdentifiers'

// One valid + one invalid sample per country, per identifier.
const CASES = [
  { country: 'NL', coc: ['12345678', '1234567'], vat: ['NL123456789B01', 'NL123456789'] },
  { country: 'BE', coc: ['0123456789', '12345678'], vat: ['BE0123456789', 'BE123456789'] },
  { country: 'DE', coc: ['HRB 12345', '12345678'], vat: ['DE123456789', 'DE12345678'] },
  { country: 'FR', coc: ['123456789', '1234567'], vat: ['FR12123456789', 'FR123456789'] },
] as const

describe('companyIdentifiers — per-country rules', () => {
  CASES.forEach(({ country, coc, vat }) => {
    it(`accepts a valid ${country} KvK/register number and rejects a malformed one`, () => {
      expect(checkIdentifier('coc', coc[0], country).status).toBe('valid')
      expect(checkIdentifier('coc', coc[1], country).status).toBe('invalid')
    })

    it(`accepts a valid ${country} VAT number and rejects a malformed one`, () => {
      expect(checkIdentifier('vat', vat[0], country).status).toBe('valid')
      expect(checkIdentifier('vat', vat[1], country).status).toBe('invalid')
    })
  })

  // The exact regression Danny reported: the Dutch 8-digit rule applied everywhere.
  it('does not apply the Dutch 8-digit KvK rule to BE/DE/FR', () => {
    expect(checkIdentifier('coc', '12345678', 'BE').status).toBe('invalid')
    expect(checkIdentifier('coc', '12345678', 'FR').status).toBe('invalid')
    expect(checkIdentifier('coc', '0123456789', 'NL').status).toBe('invalid')
  })

  it('does not apply the Dutch VAT prefix rule to BE/DE/FR', () => {
    expect(checkIdentifier('vat', 'NL123456789B01', 'BE').status).toBe('invalid')
    expect(checkIdentifier('vat', 'BE0123456789', 'NL').status).toBe('invalid')
  })

  it('ignores the separators people actually type', () => {
    expect(normalizeIdentifier(' nl 1234 5678 9 b01 ')).toBe('NL123456789B01')
    expect(checkIdentifier('vat', 'NL 1234.567-89 B01', 'NL').status).toBe('valid')
    expect(checkIdentifier('coc', 'HRB-12345', 'DE').status).toBe('valid')
  })
})

describe('companyIdentifiers — country resolution', () => {
  it('accepts an ISO-2 code as stored by the API', () => {
    expect(resolveCountryCode('NL')).toBe('NL')
    expect(resolveCountryCode('be')).toBe('BE')
  })

  it('accepts the country NAMES the older create forms still submit', () => {
    expect(resolveCountryCode('Nederland')).toBe('NL')
    expect(resolveCountryCode('Belgique')).toBe('BE')
    expect(resolveCountryCode('Deutschland')).toBe('DE')
    expect(resolveCountryCode('France')).toBe('FR')
  })

  it('returns null for anything it cannot map, instead of guessing', () => {
    expect(resolveCountryCode('')).toBeNull()
    expect(resolveCountryCode(null)).toBeNull()
    expect(resolveCountryCode('Atlantis')).toBeNull()
  })

  it('falls back to the VAT number own country prefix when the record has no country', () => {
    expect(checkIdentifier('vat', 'BE0123456789', null).status).toBe('valid')
    expect(checkIdentifier('vat', 'BE12345', null).status).toBe('invalid')
  })

  it('leaves a KvK number unverifiable when no country can be resolved', () => {
    expect(checkIdentifier('coc', '12345678', null).status).toBe('unverifiable')
    expect(checkIdentifier('coc', '12345678', 'Atlantis').status).toBe('unverifiable')
  })

  it('never calls a blank value a format error', () => {
    expect(checkIdentifier('coc', '', 'NL').status).toBe('empty')
    expect(checkIdentifier('vat', '   ', 'NL').status).toBe('empty')
  })
})

describe('companyIdentifiers — warn vs block', () => {
  const invalid = checkIdentifier('coc', '123', 'NL')
  const unverifiable = checkIdentifier('coc', '123', null)
  const valid = checkIdentifier('coc', '12345678', 'NL')

  it('blocks a mismatch only when the tenant asked for it', () => {
    expect(identifierSeverity(invalid, 'block')).toBe('error')
    expect(identifierSeverity(invalid, 'warn')).toBe('warning')
  })

  it('never blocks on an unknown country — a soft hint only', () => {
    expect(identifierSeverity(unverifiable, 'block')).toBe('warning')
    expect(identifierSeverity(unverifiable, 'warn')).toBe('warning')
  })

  it('says nothing at all about a valid or empty value', () => {
    expect(identifierSeverity(valid, 'block')).toBeNull()
    expect(identifierSeverity(checkIdentifier('vat', '', 'NL'), 'block')).toBeNull()
  })

  it('reads the tenant setting tolerantly and defaults to warn', () => {
    expect(parseIdentifierValidationMode('block')).toBe('block')
    expect(parseIdentifierValidationMode('BLOCK')).toBe('block')
    expect(parseIdentifierValidationMode('warn')).toBe('warn')
    expect(parseIdentifierValidationMode(undefined)).toBe(DEFAULT_IDENTIFIER_VALIDATION_MODE)
    expect(parseIdentifierValidationMode('nonsense')).toBe(DEFAULT_IDENTIFIER_VALIDATION_MODE)
  })
})

describe('companyIdentifiers — settings reference data', () => {
  it('exposes an example for every supported country, both identifiers', () => {
    expect(SUPPORTED_IDENTIFIER_COUNTRIES).toEqual(['NL', 'BE', 'DE', 'FR'])
    SUPPORTED_IDENTIFIER_COUNTRIES.forEach(code => {
      expect(identifierExample('coc', code)).toBeTruthy()
      expect(identifierExample('vat', code)).toBeTruthy()
    })
  })

  it('every published example actually passes its own rule', () => {
    SUPPORTED_IDENTIFIER_COUNTRIES.forEach(code => {
      expect(checkIdentifier('coc', identifierExample('coc', code), code).status).toBe('valid')
      expect(checkIdentifier('vat', identifierExample('vat', code), code).status).toBe('valid')
    })
  })

  it('returns null for a country it has no rules for', () => {
    expect(identifierExample('coc', 'ES')).toBeNull()
  })
})
