// KOIOS-TOOL-RESULT-KEYS-3 pin (FE first, RETIRED-KEYS-ORDER-1): the search_all step buckets are read by their
// English names, and the Dutch names still resolve through the alias table until the BE flip lands; after that
// landing the table goes and this test flips to "a Dutch bucket renders no line".
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import i18n from '@/i18n'
import KoiosMessage from './KoiosMessage'
import { LEGACY_RESULT_BUCKET_TYPES } from './koiosResultBucketAliases'
import type { KoiosChatMessage } from '@/types/koios'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts) as string
const refs = [{ type: 'candidate', id: 'c1', label: 'Ahmed Vos' }]

// One search_all step whose per-entity result carries the given buckets.
const build = (result: Record<string, unknown>): KoiosChatMessage => ({
  role: 'assistant', answer: 'Found', steps: [{ tool: 'search_all', refs, result } as unknown as Record<string, unknown>],
} as unknown as KoiosChatMessage)

// The English bucket name the BE emits for each Dutch alias (KOIOS-TOOL-RESULT-KEYS-3 list).
const ENGLISH_FOR: Record<string, string> = {
  kandidaten: 'candidates', vacatures: 'vacancies', klanten: 'customers', kansen: 'opportunities',
  contactpersonen: 'contacts', taken: 'tasks', locaties: 'locations',
}

describe('search_all result buckets (KOIOS-TOOL-RESULT-KEYS-3)', () => {
  it('covers every Dutch alias with an English bucket name', () => {
    expect(Object.keys(LEGACY_RESULT_BUCKET_TYPES).sort()).toEqual(Object.keys(ENGLISH_FOR).sort())
  })

  it('renders an English-named skipped bucket, and the Dutch alias renders the same line', () => {
    for (const [dutch, english] of Object.entries(ENGLISH_FOR)) {
      const en = render(<KoiosMessage msg={build({ [english]: { count: 1, skipped: true, reason: 'no permission' } })} t={t} />)
      const englishText = en.container.textContent
      en.unmount()
      expect(englishText).toContain('no permission')
      const nl = render(<KoiosMessage msg={build({ [dutch]: { count: 1, skipped: true, reason: 'no permission' } })} t={t} />)
      expect(nl.container.textContent).toBe(englishText)
      nl.unmount()
    }
  })
})
