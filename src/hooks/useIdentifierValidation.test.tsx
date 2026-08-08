/**
 * useIdentifierValidation — the tenant setting really decides warn-vs-block, and
 * an unknown country stays a soft hint no matter what the tenant chose
 * (KVK/BTW-PER-LAND-1, Danny 08-08 points 10 + 11).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIdentifierValidation } from './useIdentifierValidation'

// The shared settings blob is the ONE input this hook has besides the pure rules.
const settings: Record<string, unknown> = {}
vi.mock('@/lib/settings/useAllSettings', () => ({ useAllSettings: () => settings }))
// t() echoes the key so the assertions read as the contract, not as Dutch copy.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'nl' } }),
}))

beforeEach(() => { Object.keys(settings).forEach(k => delete settings[k]) })

describe('useIdentifierValidation', () => {
  it('says nothing about a well-formed number for its own country', () => {
    const { result } = renderHook(() => useIdentifierValidation())
    expect(result.current.notice('coc', '12345678', 'NL')).toBeNull()
    expect(result.current.notice('vat', 'BE0123456789', 'BE')).toBeNull()
  })

  it('warns (never blocks) by default on a mismatch', () => {
    const { result } = renderHook(() => useIdentifierValidation())
    expect(result.current.mode).toBe('warn')
    expect(result.current.notice('coc', '12345678', 'BE')).toEqual({
      message: 'identifierCheck.cocInvalid', severity: 'warning',
    })
  })

  it('blocks the same mismatch once the tenant switched the setting to block', () => {
    settings.company_identifier_validation = 'block'
    const { result } = renderHook(() => useIdentifierValidation())
    expect(result.current.mode).toBe('block')
    expect(result.current.notice('vat', 'NL123456789B01', 'DE')).toEqual({
      message: 'identifierCheck.vatInvalid', severity: 'error',
    })
  })

  it('keeps an unknown country a soft hint even in block mode', () => {
    settings.company_identifier_validation = 'block'
    const { result } = renderHook(() => useIdentifierValidation())
    expect(result.current.notice('coc', '12345678', '')).toEqual({
      message: 'identifierCheck.cocUnverifiable', severity: 'warning',
    })
  })

  it('never complains about an empty field', () => {
    settings.company_identifier_validation = 'block'
    const { result } = renderHook(() => useIdentifierValidation())
    expect(result.current.notice('coc', '', 'NL')).toBeNull()
    expect(result.current.notice('vat', null, null)).toBeNull()
  })
})
