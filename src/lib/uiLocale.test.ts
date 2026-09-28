import { describe, it, expect, afterEach } from 'vitest'
import { uiLocale } from './uiLocale'

// KOIOS-LOCALE-1: the chat body carries the user's UI language so the assistant answers
// in it (Danny 28-09: Dutch answers for an English user).
describe('uiLocale', () => {
  afterEach(() => { document.documentElement.lang = '' })

  it('returns the bare language code from <html lang>', () => {
    document.documentElement.lang = 'en'
    expect(uiLocale()).toBe('en')
  })

  it('strips a region suffix and lowercases', () => {
    document.documentElement.lang = 'nl-NL'
    expect(uiLocale()).toBe('nl')
    document.documentElement.lang = 'PT_br'
    expect(uiLocale()).toBe('pt')
  })

  it('returns undefined when no language is set yet', () => {
    document.documentElement.lang = ''
    expect(uiLocale()).toBeUndefined()
  })
})
