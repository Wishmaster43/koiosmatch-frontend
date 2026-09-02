/**
 * languageDisplayName / ADDABLE_LANGUAGE_CODES — ICU-driven language naming for
 * the workflow "add a language" picker (02-09).
 */
import { describe, it, expect } from 'vitest'
import { languageDisplayName, ADDABLE_LANGUAGE_CODES } from './languageNames'
import { MESSAGING_LANGUAGES } from '@/modules/messagingLanguages'

describe('languageDisplayName', () => {
  it('renders a Dutch-UI name for an addable language', () => {
    expect(languageDisplayName('pl', 'nl')).toBe('Pools')
    expect(languageDisplayName('pap', 'nl')).toBe('Papiaments')
  })

  it('renders an English-UI name for a default language', () => {
    expect(languageDisplayName('nl', 'en')).toBe('Dutch')
  })

  it('falls back to the code for an unknown language', () => {
    expect(languageDisplayName('zz', 'nl').length).toBeGreaterThan(0)
  })
})

describe('ADDABLE_LANGUAGE_CODES', () => {
  it('has no duplicates', () => {
    expect(new Set(ADDABLE_LANGUAGE_CODES).size).toBe(ADDABLE_LANGUAGE_CODES.length)
  })

  it('never repeats one of the seven MESSAGING_LANGUAGES defaults', () => {
    for (const code of MESSAGING_LANGUAGES) {
      expect(ADDABLE_LANGUAGE_CODES).not.toContain(code)
    }
  })
})
