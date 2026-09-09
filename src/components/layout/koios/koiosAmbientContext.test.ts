import { describe, it, expect } from 'vitest'
import { getPagePathFromHash, deriveAmbientRef, refsFromAppLinks } from './koiosAmbientContext'

describe('getPagePathFromHash', () => {
  // The page segment sits before either '/' or '?'.
  it('reads the page from a bare hash', () => {
    expect(getPagePathFromHash('#candidates')).toBe('candidates')
  })

  it('reads the page from a hash with an open-id query', () => {
    expect(getPagePathFromHash('#candidates?open=abc')).toBe('candidates')
  })

  it('reads the page from a legacy sub-path hash', () => {
    expect(getPagePathFromHash('#settings/ai/koios')).toBe('settings')
  })

  it('handles an empty hash', () => {
    expect(getPagePathFromHash('')).toBe('')
  })
})

describe('deriveAmbientRef', () => {
  // An open candidate on the candidates page resolves to a 'candidate' ref.
  it('derives a candidate ref from an open candidates drawer', () => {
    expect(deriveAmbientRef('#candidates?open=c-1')).toEqual({ type: 'candidate', id: 'c-1', page: 'candidates' })
  })

  // Every entity page with a RESULT_REF_PAGE entry resolves the same way.
  it('derives a vacancy ref from an open vacancies drawer', () => {
    expect(deriveAmbientRef('#vacancies?open=v-9')).toEqual({ type: 'vacancy', id: 'v-9', page: 'vacancies' })
  })

  it('derives an outreach_campaign ref (plural page, underscored type)', () => {
    expect(deriveAmbientRef('#outreach?open=o-4')).toEqual({ type: 'outreach_campaign', id: 'o-4', page: 'outreach' })
  })

  // No drawer open on an entity page — no ambient ref.
  it('returns null when nothing is open', () => {
    expect(deriveAmbientRef('#candidates')).toBeNull()
  })

  // A non-entity page (settings, dashboard, …) is never a source of ambient context.
  it('returns null on a page with no context-ref type', () => {
    expect(deriveAmbientRef('#settings?open=x')).toBeNull()
  })

  it('returns null on an empty hash', () => {
    expect(deriveAmbientRef('')).toBeNull()
  })
})

// Danny 09-09 ("Koios AI snapt de link niet"): a pasted Koios Match deep link becomes the
// record it points at, so the chat receives the id instead of guessing from the text.
describe('refsFromAppLinks', () => {
  it('extracts the record behind a full app URL and a bare hash, deduped', () => {
    const text = 'Kijk naar http://localhost:5173/#candidates?open=b6c81ca6-9aa5-4aad-847c-b2e0a66b9fee en #candidates?open=b6c81ca6-9aa5-4aad-847c-b2e0a66b9fee graag'
    expect(refsFromAppLinks(text)).toEqual([{ type: 'candidate', id: 'b6c81ca6-9aa5-4aad-847c-b2e0a66b9fee' }])
  })

  it('returns nothing for text without an app link', () => {
    expect(refsFromAppLinks('bel haar morgen')).toEqual([])
  })
})
