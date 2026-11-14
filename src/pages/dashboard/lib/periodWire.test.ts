/**
 * periodWire — the English period ids.
 */
import { describe, it, expect } from 'vitest'
import { PERIOD_KEYS } from './periodWire'

describe('periodWire', () => {
  it('lists the five English period ids in display order', () => {
    expect([...PERIOD_KEYS]).toEqual(['today', 'week', 'month', 'quarter', 'year'])
  })
})
