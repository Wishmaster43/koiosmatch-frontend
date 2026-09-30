/**
 * readWindowSetting — amount via getNumberSetting, unit tolerant (missing/unknown → default).
 */
import { describe, it, expect } from 'vitest'
import { readWindowSetting } from './readWindowSetting'

describe('readWindowSetting · WINDOW-UNIT-READERS-1', () => {
  it('reads amount + unit from the settings blob', () => {
    expect(readWindowSetting({ foo: 14, foo_unit: 'weeks' }, 'foo', 30)).toEqual({ amount: 14, unit: 'weeks' })
  })

  it('falls back to the default unit when the unit key is absent', () => {
    expect(readWindowSetting({ foo: 14 }, 'foo', 30)).toEqual({ amount: 14, unit: 'days' })
  })

  it('falls back to the default unit when the stored unit is unrecognised', () => {
    expect(readWindowSetting({ foo: 14, foo_unit: 'hours' }, 'foo', 30)).toEqual({ amount: 14, unit: 'days' })
  })

  it('falls back to the default amount when the amount key is absent', () => {
    expect(readWindowSetting({}, 'foo', 30)).toEqual({ amount: 30, unit: 'days' })
  })
})
