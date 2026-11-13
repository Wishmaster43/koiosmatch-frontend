/**
 * moduleI18n — render-layer translation for registry strings: key derivation
 * (strip i18next separators, flatten newlines) and the placeholder/hint helpers
 * added for the module registry (fieldPlaceholders.* / fieldHints.*).
 */
import { describe, it, expect } from 'vitest'
import { fieldHint, fieldLabel, fieldPlaceholder, i18nKey, optionLabel } from './moduleI18n'

// Minimal t + checker stubs over one dictionary; both refuse any namespace other than 'workflows',
// so a lookup in the wrong namespace would surface as WRONG-NS instead of passing silently.
const dict: Record<string, string> = {
  'fieldLabels.Name': 'translated label',
  'fieldOptions.GET': 'translated option',
  'fieldPlaceholders.Eg Yessy AI': 'translated placeholder',
  'fieldHints.One name per line': 'translated hint',
}
const t = (key: string, o?: { ns?: string }) => (o?.ns === 'workflows' ? dict[key] ?? key : `WRONG-NS:${key}`)
const i18n = { exists: (key: string, o?: { ns?: string }) => o?.ns === 'workflows' && key in dict }

describe('i18nKey', () => {
  it('strips i18next separators (. and :) from the source string', () => {
    expect(i18nKey('E.g. Yessy AI')).toBe('Eg Yessy AI')
    expect(i18nKey('note: this')).toBe('note this')
  })

  it('flattens newlines so multi-line placeholders make one JSON key', () => {
    expect(i18nKey('name_1\nname_2')).toBe('name_1 name_2')
  })
})

describe('fieldPlaceholder / fieldHint / fieldLabel / optionLabel', () => {
  it('translates a known label via fieldLabels.* and keeps an unknown label as the raw registry string', () => {
    expect(fieldLabel(t, i18n, 'Name')).toBe('translated label')
    expect(fieldLabel(t, i18n, 'Unknown label')).toBe('Unknown label')
  })

  it('translates a known option via fieldOptions.* and keeps a technical value (JSON) as-is', () => {
    expect(optionLabel(t, i18n, 'GET')).toBe('translated option')
    expect(optionLabel(t, i18n, 'JSON')).toBe('JSON')
    expect(optionLabel(t, i18n, undefined)).toBe('')
  })

  it('translates a known placeholder via fieldPlaceholders.*', () => {
    expect(fieldPlaceholder(t, i18n, 'E.g. Yessy AI')).toBe('translated placeholder')
  })

  it('translates a known hint via fieldHints.*', () => {
    expect(fieldHint(t, i18n, 'One name per line.')).toBe('translated hint')
  })

  it('falls back to the raw source for language-neutral values', () => {
    expect(fieldPlaceholder(t, i18n, '{{trigger.session_id}}')).toBe('{{trigger.session_id}}')
    expect(fieldHint(t, i18n, '10000')).toBe('10000')
  })

  it('returns an empty string for absent values', () => {
    expect(fieldPlaceholder(t, i18n, undefined)).toBe('')
    expect(fieldHint(t, i18n, undefined)).toBe('')
    expect(fieldLabel(t, i18n, undefined)).toBe('')
  })
})
