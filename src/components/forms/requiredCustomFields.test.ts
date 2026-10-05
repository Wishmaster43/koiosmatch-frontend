/**
 * requiredCustomFields — pure-helper tests (ONIX N-005, SHARED-UNIT-TEST-1).
 */
import { describe, it, expect } from 'vitest'
import { isRequiredCustomField, requiredCustomFieldKeys, isCustomFieldFilled, requiredCustomFieldErrors } from './requiredCustomFields'
import type { CustomFieldDef } from '@/lib/useCustomFields'

const def = (overrides: Partial<CustomFieldDef>): CustomFieldDef => ({
  key: 'vog', label: 'VOG', type: 'text', sort_order: 0, active: true, has_data: false, visible_in_ui: true,
  required_always: false, required_for: [], ...overrides,
})

describe('isRequiredCustomField', () => {
  it('is true for required_always', () => { expect(isRequiredCustomField(def({ required_always: true }))).toBe(true) })
  it('is true for a non-empty required_for', () => { expect(isRequiredCustomField(def({ required_for: ['hired'] }))).toBe(true) })
  it('is false when neither applies', () => { expect(isRequiredCustomField(def({}))).toBe(false) })
})

describe('requiredCustomFieldKeys', () => {
  it('maps each def to its dotted bag key', () => {
    expect(requiredCustomFieldKeys([def({ key: 'vog' }), def({ key: 'bhv' })])).toEqual(['custom_fields.vog', 'custom_fields.bhv'])
  })
  it('returns an empty list for an empty input', () => { expect(requiredCustomFieldKeys([])).toEqual([]) })
})

describe('isCustomFieldFilled', () => {
  it('treats false as filled (a real boolean answer)', () => { expect(isCustomFieldFilled(false)).toBe(true) })
  it('treats true as filled', () => { expect(isCustomFieldFilled(true)).toBe(true) })
  it('treats a non-empty string as filled', () => { expect(isCustomFieldFilled('yes')).toBe(true) })
  it('treats a whitespace-only string as NOT filled', () => { expect(isCustomFieldFilled('   ')).toBe(false) })
  it('treats undefined/null/empty string as NOT filled', () => {
    expect(isCustomFieldFilled(undefined)).toBe(false)
    expect(isCustomFieldFilled(null)).toBe(false)
    expect(isCustomFieldFilled('')).toBe(false)
  })
  it('treats a number as filled', () => { expect(isCustomFieldFilled(0)).toBe(true) })
})

describe('requiredCustomFieldErrors', () => {
  it('returns null when every required def is filled', () => {
    expect(requiredCustomFieldErrors([def({ key: 'vog', required_always: true })], { vog: 'yes' })).toBeNull()
  })
  it('returns the dotted error flags for every empty required def', () => {
    expect(requiredCustomFieldErrors(
      [def({ key: 'vog', required_always: true }), def({ key: 'bhv', required_always: true })],
      { vog: '' },
    )).toEqual({ 'custom_fields.vog': true, 'custom_fields.bhv': true })
  })
  it('returns null for an empty def list', () => { expect(requiredCustomFieldErrors([], {})).toBeNull() })
})
