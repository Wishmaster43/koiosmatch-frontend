/**
 * smStatus — regression pin for the ONIX fix (magic-string duplication ×6):
 * every SM-status comparison in reports + shiftmanager pages goes through this
 * one vocabulary + normalisation, so the values and the fallback are asserted
 * here once instead of implicitly per call-site.
 */
import { describe, it, expect } from 'vitest'
import { SM_STATUS, statusOf } from './smStatus'

describe('smStatus', () => {
  it('carries the exact external Shiftmanager vocabulary (never translated)', () => {
    expect(SM_STATUS).toEqual({ ACTIVE: 'actief', INACTIVE: 'nietactief', INTAKE: 'intake', DELETED: 'verwijderd' })
  })

  it('normalises case and falls back to onbekend for missing status', () => {
    expect(statusOf({ status: 'Actief' })).toBe(SM_STATUS.ACTIVE)
    expect(statusOf({ status: 'NIETACTIEF' })).toBe(SM_STATUS.INACTIVE)
    expect(statusOf({ status: null })).toBe('onbekend')
    expect(statusOf({})).toBe('onbekend')
    expect(statusOf({ status: '' })).toBe('onbekend')
  })

  it('keeps an unknown raw value intact so counts never mislabel it', () => {
    expect(statusOf({ status: 'extern' })).toBe('extern')
  })
})
