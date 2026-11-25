// KOIOS-TOOL-RESULT-KEYS-3 pin, phase B (BE MINI-BUNDLE-12 landed the flip in batch K a551fa5f6): the search_all
// step buckets are attributed by their English names ONLY; the alias table is gone, so a retired Dutch key is no
// longer mapped onto the candidate/vacancy/… entity and keeps its raw key. FIND-1 still holds: the reason line of a
// skipped bucket renders for any key, so a bucket the FE does not know is never silently dropped.
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import i18n from '@/i18n'
import KoiosMessage from './KoiosMessage'
import { groupSearchResults } from './koiosSearchResultsGrouping'
import type { KoiosChatMessage } from '@/types/koios'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts) as string
const refs = [{ type: 'candidate', id: 'c1', label: 'Ahmed Vos' }]

// One search_all step whose per-entity result carries the given buckets.
const step = (result: Record<string, unknown>) => ({ tool: 'search_all', refs, result } as unknown as Record<string, unknown>)
const build = (result: Record<string, unknown>): KoiosChatMessage => ({
  role: 'assistant', answer: 'Found', steps: [step(result)],
} as unknown as KoiosChatMessage)

// The English bucket name the BE emits, next to the retired Dutch name it no longer sends (KOIOS-TOOL-RESULT-KEYS-3 list).
const ENGLISH_FOR: Record<string, string> = {
  kandidaten: 'candidates', vacatures: 'vacancies', klanten: 'customers', kansen: 'opportunities',
  contactpersonen: 'contacts', taken: 'tasks', locaties: 'locations',
}
const ENTITY_FOR: Record<string, string> = {
  candidates: 'candidate', vacancies: 'vacancy', customers: 'customer', opportunities: 'opportunity',
  contacts: 'contact', tasks: 'task', locations: 'location',
}

describe('search_all result buckets (KOIOS-TOOL-RESULT-KEYS-3)', () => {
  it('attributes an English-named bucket to its entity and leaves a retired Dutch name on its raw key', () => {
    for (const [dutch, english] of Object.entries(ENGLISH_FOR)) {
      const en = groupSearchResults(step({ [english]: { count: 1, skipped: true, reason: 'no permission' } }), refs)
      expect(en.skipped).toEqual([{ entity: ENTITY_FOR[english], reason: 'no permission' }])
      const nl = groupSearchResults(step({ [dutch]: { count: 1, skipped: true, reason: 'no permission' } }), refs)
      expect(nl.skipped).toEqual([{ entity: dutch, reason: 'no permission' }])
    }
  })

  it('renders the skipped reason for an English-named bucket AND for an unknown (retired Dutch) key (FIND-1: never dropped)', () => {
    const en = render(<KoiosMessage msg={build({ candidates: { count: 1, skipped: true, reason: 'no permission' } })} t={t} />)
    expect(en.container.textContent).toContain('no permission')
    en.unmount()
    const nl = render(<KoiosMessage msg={build({ kandidaten: { count: 1, skipped: true, reason: 'no permission' } })} t={t} />)
    expect(nl.container.textContent).toContain('no permission')
    nl.unmount()
  })
})
