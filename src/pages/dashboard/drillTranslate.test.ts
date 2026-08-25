/**
 * drillTranslate — pins the customers translators added for DASH-FEEDS-V3
 * (owner_id/phase) and the untranslatable-fallback contract for an unknown param.
 */
import { describe, it, expect } from 'vitest'
import { translateDrill } from './drillTranslate'

describe('translateDrill · customers', () => {
  it('translates owner_id to an owner intent', () => {
    expect(translateDrill({ entity: 'customers', params: { owner_id: 5 } }))
      .toEqual({ page: 'customers', intent: { owner: 5 } })
  })

  it('translates phase to a phase intent', () => {
    expect(translateDrill({ entity: 'customers', params: { phase: 'active' } }))
      .toEqual({ page: 'customers', intent: { phase: 'active' } })
  })

  it('returns null for a param this table cannot express', () => {
    expect(translateDrill({ entity: 'customers', params: { unknown_param: 1 } })).toBeNull()
  })
})
