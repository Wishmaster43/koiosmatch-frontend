/**
 * insightsHelpers.pickOne — the donut click toggles one value in the filter list:
 * click → [value], click again → [], another value replaces the selection.
 */
import { describe, it, expect } from 'vitest'
import { pickOne } from './insightsHelpers'

describe('pickOne', () => {
  it('toggles a single value in and out and reads key, payload.key or name', () => {
    let state: string[] = []
    const set = (fn: string[] | ((p: string[]) => string[])) => { state = typeof fn === 'function' ? fn(state) : fn }
    const pick = pickOne(set as never)
    pick({ key: 'open' }); expect(state).toEqual(['open'])
    pick({ payload: { key: 'open' } }); expect(state).toEqual([])
    pick({ name: 'closed' }); expect(state).toEqual(['closed'])
    pick({ key: 'open' }); expect(state).toEqual(['open'])
    pick({}); expect(state).toEqual(['open'])
  })
})
