/**
 * Regression (found 28-07 by an audit, not by a gate): a refactor dropped `label` from
 * the shared LANGUAGES constant while CompanySettings still did
 * `APP_LANGUAGES.map(l => l.label)`. The company-language dropdown therefore rendered
 * five EMPTY options and the saved value matched nothing — live on main, invisible to
 * both gates, because that settings file is .jsx (so tsc skips it) and had no test.
 *
 * This pins the CONTRACT of the constant rather than one screen, since every consumer
 * reads a different field of it: the profile picker uses value+flag, the company setting
 * uses label.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LANGUAGES, Pill } from './profileParts'

describe('LANGUAGES — the shared language list', () => {
  it('carries the seven shipped locales', () => {
    expect(LANGUAGES.map(l => l.value)).toEqual(['nl', 'en', 'de', 'fr', 'es', 'it', 'pt'])
  })

  it('gives every entry a non-empty value, flag AND label', () => {
    LANGUAGES.forEach(l => {
      expect(l.value, `value of ${JSON.stringify(l)}`).toBeTruthy()
      expect(l.flag, `flag of ${l.value}`).toBeTruthy()
      expect(l.label, `label of ${l.value}`).toBeTruthy()
    })
  })

  // Endonyms on purpose: the label is STORED by the company-language setting, so it may
  // not change when the interface language changes.
  it('labels the languages in their own name', () => {
    expect(LANGUAGES.find(l => l.value === 'nl')?.label).toBe('Nederlands')
    expect(LANGUAGES.find(l => l.value === 'de')?.label).toBe('Deutsch')
  })
})

// Pill must build its fill/border/ink from the house §4 tint helpers (lib/tint),
// never a hand-rolled color-mix percentage or the raw colour as its own ink.
describe('Pill — §4 tint helpers, not an ad-hoc color-mix', () => {
  it('derives background/border/ink from tintBg/tintBorder/chipInk for the default colour', () => {
    render(<Pill label="Test" />)
    const pill = screen.getByText('Test')
    // chipInk mixes the colour toward --text (never the raw colour as its own ink).
    expect(pill.style.color).toContain('color-mix(in srgb, var(--text-muted)')
    expect(pill.style.color).toContain('var(--text)')
    expect(pill.style.background).toContain('color-mix(in srgb, var(--text-muted) 10%')
    expect(pill.style.border).toContain('color-mix(in srgb, var(--text-muted) 33%')
  })

  it('still honours an explicit bg override (ROLE_META) while keeping the AA-safe ink', () => {
    render(<Pill label="Admin" color="var(--color-violet)" bg="var(--color-violet-bg)" />)
    const pill = screen.getByText('Admin')
    expect(pill.style.background).toBe('var(--color-violet-bg)')
    expect(pill.style.color).toContain('color-mix(in srgb, var(--color-violet)')
  })
})
