/**
 * moduleI18n — render-layer translation for registry strings: key derivation
 * (strip i18next separators, flatten newlines) and the placeholder/hint helpers
 * added for the module registry (fieldPlaceholders.* / fieldHints.*).
 */
import { describe, it, expect } from 'vitest'
import { fieldHint, fieldLabel, fieldPlaceholder, i18nKey } from './moduleI18n'

// Minimal t stub: dictionary lookup with i18next's defaultValue fallback.
const dict: Record<string, string> = {
  'fieldLabels.Naam': 'Name',
  'fieldPlaceholders.Bijv Yessy AI': 'E.g. Yessy AI',
  'fieldHints.Eén naam per regel': 'One name per line.',
}
const t = (key: string, opts?: { defaultValue?: string }) => dict[key] ?? opts?.defaultValue ?? key

describe('i18nKey', () => {
  it('strips i18next separators (. and :) from the source string', () => {
    expect(i18nKey('Bijv. Yessy AI')).toBe('Bijv Yessy AI')
    expect(i18nKey('let op: dit')).toBe('let op dit')
  })

  it('flattens newlines so multi-line placeholders make one JSON key', () => {
    expect(i18nKey('naam_1\nnaam_2')).toBe('naam_1 naam_2')
  })
})

describe('fieldPlaceholder / fieldHint / fieldLabel', () => {
  it('translates a known placeholder via fieldPlaceholders.*', () => {
    expect(fieldPlaceholder(t, 'Bijv. Yessy AI')).toBe('E.g. Yessy AI')
  })

  it('translates a known hint via fieldHints.*', () => {
    expect(fieldHint(t, 'Eén naam per regel.')).toBe('One name per line.')
  })

  it('falls back to the raw source for language-neutral values', () => {
    expect(fieldPlaceholder(t, '{{trigger.session_id}}')).toBe('{{trigger.session_id}}')
    expect(fieldHint(t, '10000')).toBe('10000')
  })

  it('returns an empty string for absent values', () => {
    expect(fieldPlaceholder(t, undefined)).toBe('')
    expect(fieldHint(t, undefined)).toBe('')
    expect(fieldLabel(t, undefined)).toBe('')
  })
})
