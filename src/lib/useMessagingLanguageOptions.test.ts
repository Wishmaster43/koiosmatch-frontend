import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMessagingLanguageOptions } from './useMessagingLanguageOptions'

// Note: i18n is not initialised in tests → locale falls back to 'nl' (§3B, mirrors datetime.test.ts).
describe('useMessagingLanguageOptions', () => {
  it('lists the seven defaults first, in canonical order', () => {
    const { result } = renderHook(() => useMessagingLanguageOptions())
    const codes = result.current.options.map(o => o.value)
    expect(codes.slice(0, 7)).toEqual(['nl', 'en', 'de', 'fr', 'es', 'pl', 'ro'])
  })

  // Addable codes follow, sorted alphabetically by their display name.
  it('sorts the addable codes after the defaults by display name', () => {
    const { result } = renderHook(() => useMessagingLanguageOptions())
    const rest = result.current.options.slice(7).map(o => o.label)
    const sorted = [...rest].sort((a, b) => a.localeCompare(b, 'nl'))
    expect(rest).toEqual(sorted)
  })

  it('labelFor resolves a known code to "<name> (<CODE>)"', () => {
    const { result } = renderHook(() => useMessagingLanguageOptions())
    expect(result.current.labelFor('nl')).toMatch(/\(NL\)$/)
  })
})
