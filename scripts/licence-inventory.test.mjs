import { describe, it, expect } from 'vitest'
import { classifyLicence, checkLicences } from './licence-inventory.mjs'

const lockOf = (entries) => ({
  packages: { '': { name: 'root' }, ...Object.fromEntries(entries.map(([n, l]) => [`node_modules/${n}`, l === undefined ? {} : { license: l }])) },
})
const entry = (name, expires = '2099-01-01', reason = 'because') => ({ name, licence: 'x', reason, expires })

describe('classifyLicence', () => {
  it('classifies families', () => {
    expect(classifyLicence('MIT')).toBe('permissive')
    expect(classifyLicence('(MPL-2.0 OR Apache-2.0)')).toBe('permissive')
    expect(classifyLicence('(MIT AND Zlib)')).toBe('permissive')
    expect(classifyLicence(['MIT', 'Apache2'])).toBe('permissive')
    expect(classifyLicence('GPL-3.0')).toBe('non-permissive')
    expect(classifyLicence('(GPL-3.0 AND MIT)')).toBe('non-permissive')
    expect(classifyLicence(undefined)).toBe('missing')
    expect(classifyLicence('(MIT OR GPL-3.0) AND GPL-3.0')).toBe('non-permissive')
    expect(classifyLicence('(MIT OR ISC) AND (GPL-3.0 OR MIT)')).toBe('permissive')
    expect(classifyLicence('GPL-3.0 AND MIT')).toBe('non-permissive')
    expect(classifyLicence('MIT OR GPL-3.0')).toBe('permissive')
    expect(classifyLicence('(MIT OR')).toBe('non-permissive')
  })
})

describe('checkLicences', () => {
  it('passes permissive and OR packages', () => {
    expect(checkLicences(lockOf([['a', 'MIT'], ['b', '(GPL-3.0 OR MIT)']]), []).problems).toEqual([])
  })
  it('fails an unlisted GPL package', () => {
    expect(checkLicences(lockOf([['g', 'GPL-3.0']]), []).problems[0]).toMatch(/not allowlisted: g/)
  })
  it('passes an allowlisted package with a reason', () => {
    expect(checkLicences(lockOf([['g', 'GPL-3.0']]), [entry('g')]).problems).toEqual([])
  })
  it('fails an expired entry', () => {
    expect(checkLicences(lockOf([['g', 'GPL-3.0']]), [entry('g', '2020-01-01')], '2026-10-29').problems[0]).toMatch(/expired/)
  })
  it('fails a stale entry', () => {
    expect(checkLicences(lockOf([['a', 'MIT']]), [entry('gone')]).problems[0]).toMatch(/stale/)
  })
  it('fails a missing licence unless allowlisted', () => {
    expect(checkLicences(lockOf([['m', undefined]]), []).problems[0]).toMatch(/missing/)
    expect(checkLicences(lockOf([['m', undefined]]), [entry('m')]).problems).toEqual([])
  })
  it('fails an allowlist entry without a reason', () => {
    expect(checkLicences(lockOf([['g', 'GPL-3.0']]), [entry('g', '2099-01-01', '')]).problems[0]).toMatch(/without reason/)
  })
})
