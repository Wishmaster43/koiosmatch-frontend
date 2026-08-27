/**
 * SEGMENT-via-workflow pins (Danny 27-08): the module kit must OFFER the
 * doelgroep vocabulary the engine already evaluates — the relative-date band
 * operators on router edges (BE FilterEvaluator, 85518268) and the months
 * config field on the candidates fetch (BE CandidatesFetchModule).
 */
import { describe, it, expect } from 'vitest'
import { OPERATOR_OPTIONS } from './constants'
import candidates from '@/modules/candidates'
import i18n from '@/i18n'

describe('segment-via-workflow vocabulary', () => {
  it('the edge editor offers both relative-date band operators', () => {
    const values = OPERATOR_OPTIONS.map(o => o.value)
    expect(values).toContain('date_older_than_days')
    expect(values).toContain('date_younger_than_days')
  })

  it('the younger-than label resolves in every locale, mirroring its sibling', () => {
    for (const lng of ['nl', 'en', 'de', 'fr', 'es']) {
      const label = i18n.t('canvas.opDateYoungerThanDays', { ns: 'workflows', lng })
      expect(label).not.toContain('opDateYoungerThanDays')
    }
    expect(i18n.t('canvas.opDateYoungerThanDays', { ns: 'workflows', lng: 'nl' })).toBe('korter dan N dagen geleden')
  })

  it('the candidates fetch module carries the last-contact months config field', () => {
    // makeEntityModule merges schemaExtra into the built module's `schema`.
    const schema = (candidates as { schema?: Array<{ key: string; type?: string; showIf?: unknown }> }).schema ?? []
    const field = schema.find(f => f.key === 'last_contact_before_months')
    expect(field).toBeTruthy()
    expect(field?.type).toBe('number')
    expect(field?.showIf).toEqual({ key: 'action', value: 'Ophalen' })
  })
})
