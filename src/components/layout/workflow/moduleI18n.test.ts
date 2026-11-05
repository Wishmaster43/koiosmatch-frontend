/**
 * moduleI18n — render-layer translation for registry strings: key derivation
 * (strip i18next separators, flatten newlines) and the placeholder/hint helpers
 * added for the module registry (fieldPlaceholders.* / fieldHints.*).
 */
import { describe, it, expect } from 'vitest'
import { fieldHint, fieldLabel, fieldPlaceholder, i18nKey } from './moduleI18n'

// Minimal t stub: dictionary lookup with i18next's defaultValue fallback.
const dict: Record<string, string> = {
  'fieldLabels.Name': 'Naam',
  'fieldPlaceholders.Eg Yessy AI': 'Bijv. Yessy AI',
  'fieldHints.One name per line': 'Eén naam per regel.',
}
const t = (key: string, opts?: { defaultValue?: string }) => dict[key] ?? opts?.defaultValue ?? key

describe('i18nKey', () => {
  it('strips i18next separators (. and :) from the source string', () => {
    expect(i18nKey('E.g. Yessy AI')).toBe('Eg Yessy AI')
    expect(i18nKey('note: this')).toBe('note this')
  })

  it('flattens newlines so multi-line placeholders make one JSON key', () => {
    expect(i18nKey('name_1\nname_2')).toBe('name_1 name_2')
  })
})

describe('fieldPlaceholder / fieldHint / fieldLabel', () => {
  it('translates a known placeholder via fieldPlaceholders.*', () => {
    expect(fieldPlaceholder(t, 'E.g. Yessy AI')).toBe('Bijv. Yessy AI')
  })

  it('translates a known hint via fieldHints.*', () => {
    expect(fieldHint(t, 'One name per line.')).toBe('Eén naam per regel.')
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
