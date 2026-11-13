/**
 * periodWire — English ids inside, Dutch wire values until the BE hash.
 */
import { describe, it, expect } from 'vitest'
import { PERIOD_KEYS, toWirePeriod } from './periodWire'

describe('periodWire', () => {
  it('lists the five English period ids in display order', () => {
    expect([...PERIOD_KEYS]).toEqual(['today', 'week', 'month', 'quarter', 'year'])
  })

  it('maps every id to the value the BE still expects', () => {
    expect(PERIOD_KEYS.map(toWirePeriod)).toEqual(['vandaag', 'week', 'maand', 'kwartaal', 'jaar'])
  })

  it('passes an unknown value through untouched', () => {
    expect(toWirePeriod('decade')).toBe('decade')
    // Own-property lookup: an inherited object name is not a period id either.
    expect(toWirePeriod('constructor')).toBe('constructor')
  })
})
