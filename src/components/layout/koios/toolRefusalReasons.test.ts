import { describe, it, expect } from 'vitest'
import { TOOL_REFUSAL_REASON_SLUGS, EXTRA_SOURCE_REFUSAL_SLUGS } from './toolRefusalReasons'
import { BE_TOOL_REFUSAL_REASON_SLUGS } from './toolRefusalReasons.generated'
import nl from '@/i18n/locales/nl/common.json'
import en from '@/i18n/locales/en/common.json'
import de from '@/i18n/locales/de/common.json'
import fr from '@/i18n/locales/fr/common.json'
import es from '@/i18n/locales/es/common.json'
import it_ from '@/i18n/locales/it/common.json'
import pt from '@/i18n/locales/pt/common.json'

type Bundle = { koios: { pendingAction: { reasons: Record<string, unknown> } } }
const LOCALES: Record<string, Bundle> = { nl, en, de, fr, es, it: it_, pt } as unknown as Record<string, Bundle>
const reasonsOf = (loc: string) => LOCALES[loc].koios.pendingAction.reasons

describe('tool refusal reason slugs', () => {
  // The generated BE mirror is a sorted, unique, non-empty list of snake_case slugs
  it('the generated BE list is sorted, unique, non-empty snake_case', () => {
    expect(BE_TOOL_REFUSAL_REASON_SLUGS.length).toBeGreaterThan(0)
    expect([...BE_TOOL_REFUSAL_REASON_SLUGS]).toEqual([...new Set(BE_TOOL_REFUSAL_REASON_SLUGS)].sort())
    for (const slug of BE_TOOL_REFUSAL_REASON_SLUGS) expect(slug).toMatch(/^[a-z][a-z0-9_]*$/)
  })

  // A hand-listed extra that the BE enum now carries is a duplicate to remove from the extras
  it('no extra-source slug duplicates a generated enum slug', () => {
    for (const slug of EXTRA_SOURCE_REFUSAL_SLUGS) expect(BE_TOOL_REFUSAL_REASON_SLUGS, slug).not.toContain(slug)
  })

  // Every slug has a non-empty translation in every locale
  it('has a non-empty value for every slug in all seven locales', () => {
    for (const loc of Object.keys(LOCALES)) {
      for (const slug of TOOL_REFUSAL_REASON_SLUGS) {
        const v = reasonsOf(loc)[slug]
        expect(typeof v === 'string' && v.trim().length > 0, `${loc}:${slug}`).toBe(true)
      }
    }
  })

  // No stray key outside the list
  it('has no key outside the slug list', () => {
    for (const loc of Object.keys(LOCALES)) {
      for (const key of Object.keys(reasonsOf(loc))) {
        expect(TOOL_REFUSAL_REASON_SLUGS, `${loc}:${key}`).toContain(key)
      }
    }
  })

  // No em dash in running copy
  it('contains no em dash', () => {
    for (const loc of Object.keys(LOCALES)) {
      for (const v of Object.values(reasonsOf(loc))) expect(String(v)).not.toContain('—')
    }
  })

  // en and nl are real sentences, not the slug echoed
  it('en and nl differ from the slug itself', () => {
    for (const loc of ['en', 'nl']) {
      for (const slug of TOOL_REFUSAL_REASON_SLUGS) expect(reasonsOf(loc)[slug], `${loc}:${slug}`).not.toBe(slug)
    }
  })
})
