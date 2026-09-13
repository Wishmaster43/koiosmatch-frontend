// provinceFlag — only the 23 shipped ISO 3166-2 codes resolve to an asset path.
import { describe, it, expect } from 'vitest'
import { provinceFlagSrc } from './provinceFlag'

describe('provinceFlagSrc', () => {
  it('resolves a shipped Dutch or Belgian code, case-insensitively', () => {
    expect(provinceFlagSrc('NL-ZH')).toBe('/flags/provinces/NL-ZH.svg')
    expect(provinceFlagSrc('be-van')).toBe('/flags/provinces/BE-VAN.svg')
  })

  it('answers null for a missing, empty or unshipped code', () => {
    expect(provinceFlagSrc(null)).toBeNull()
    expect(provinceFlagSrc('')).toBeNull()
    expect(provinceFlagSrc('DE-BY')).toBeNull()
  })
})
