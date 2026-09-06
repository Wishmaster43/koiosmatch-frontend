/**
 * composeAddressLine — the ONE address one-liner every 'address' composite, the
 * candidate Adres card, the ZZP card and the billing fallback share. I18N-1 added the
 * optional second line; its position (between street and postcode) mirrors the
 * backend's Address::oneLine(), so the FE-composed and BE-composed strings agree.
 */
import { describe, it, expect } from 'vitest'
import { composeAddressLine } from './EditableFieldTable'

describe('composeAddressLine', () => {
  it('composes street + number-suffix and postcode + city', () => {
    expect(composeAddressLine({ street: 'Kerkstraat', houseNumber: '12', houseNumberSuffix: 'a', postalCode: '1234 AB', city: 'Utrecht' }))
      .toBe('Kerkstraat 12-a, 1234 AB Utrecht')
  })
  it('puts the optional second line between the street line and the postcode line (I18N-1)', () => {
    expect(composeAddressLine({ street: 'Kerkstraat', houseNumber: '12', addressLine2: 'Gebouw B', postalCode: '1234 AB', city: 'Utrecht' }))
      .toBe('Kerkstraat 12, Gebouw B, 1234 AB Utrecht')
  })
  it('skips an empty or whitespace-only second line', () => {
    expect(composeAddressLine({ street: 'Kerkstraat', houseNumber: '12', addressLine2: '  ', postalCode: '1234 AB', city: 'Utrecht' }))
      .toBe('Kerkstraat 12, 1234 AB Utrecht')
    expect(composeAddressLine({ addressLine2: '' })).toBe('')
  })
})
