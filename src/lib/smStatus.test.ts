/**
 * smStatus — regression pins (mega-audit r2): the COMPLETE external vocabulary,
 * the hardened normalisation (non-string mirror values), and the whitespace
 * rule that keeps "Niet actief" in the same population as "nietactief".
 */
import { describe, it, expect } from 'vitest'
import { SM_STATUS, statusOf, normalizeSmStatus } from './smStatus'

describe('smStatus', () => {
  it('carries the exact external Shiftmanager vocabulary (never translated)', () => {
    expect(SM_STATUS).toEqual({
      ACTIVE: 'actief', INACTIVE: 'nietactief', INTAKE: 'intake',
      DELETED: 'verwijderd', EXTERNAL: 'extern', UNKNOWN: 'onbekend',
    })
  })

  it('normalises case, whitespace and missing values', () => {
    expect(statusOf({ status: 'Actief' })).toBe(SM_STATUS.ACTIVE)
    expect(statusOf({ status: 'Niet actief' })).toBe(SM_STATUS.INACTIVE)
    expect(statusOf({ status: 'NIETACTIEF' })).toBe(SM_STATUS.INACTIVE)
    expect(statusOf({ status: null })).toBe(SM_STATUS.UNKNOWN)
    expect(statusOf({})).toBe(SM_STATUS.UNKNOWN)
    expect(statusOf({ status: '' })).toBe(SM_STATUS.UNKNOWN)
  })

  it('never crashes on a non-string mirror value (untyped external rows)', () => {
    expect(statusOf({ status: 7 as unknown as string })).toBe('7')
    expect(statusOf({ status: false as unknown as string })).toBe('false')
  })

  it('keeps an unknown raw value intact so counts never mislabel it', () => {
    expect(normalizeSmStatus('extern')).toBe(SM_STATUS.EXTERNAL)
    expect(normalizeSmStatus('iets-anders')).toBe('iets-anders')
  })
})
