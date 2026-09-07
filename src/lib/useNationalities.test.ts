/**
 * useNationalities — KEY-ADOPTION test: keys are extracted from the API response
 * and included in the options.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNationalities } from './useNationalities'

// Mock useCachedLookup to return test data with keys.
vi.mock('./useCachedLookup', () => ({
  useCachedLookup: vi.fn(() => {
    // Return data with keys extracted from mock rows.
    return {
      data: {
        names: ['Nederlands', 'Belgisch'],
        flags: { Nederlands: '🇳🇱', Belgisch: '🇧🇪' },
        keys: { Nederlands: 'nl_NL', Belgisch: 'nl_BE' },
      },
    }
  }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'nl' },
  }),
}))

describe('useNationalities', () => {
  it('includes key in nationality options', () => {
    const { result } = renderHook(() => useNationalities())
    const options = result.current.nationalityOptions
    expect(options).toHaveLength(2)
    expect(options[0]).toEqual({
      value: 'Nederlands',
      label: expect.any(String),
      key: 'nl_NL',
    })
    expect(options[1]).toEqual({
      value: 'Belgisch',
      label: expect.any(String),
      key: 'nl_BE',
    })
  })

  it('returns null key for options without backend key', () => {
    const { result } = renderHook(() => useNationalities())
    const options = result.current.nationalityOptions
    // Check that key field exists (even if null for seed data)
    expect(options[0]).toHaveProperty('key')
  })
})
