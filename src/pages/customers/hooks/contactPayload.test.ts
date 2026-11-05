import { describe, it, expect } from 'vitest'
import { splitContactName, quickContactPayload } from './contactPayload'

describe('splitContactName', () => {
  // First word is the first name, the rest the last name.
  it('splits first word from the rest', () => {
    expect(splitContactName('Jan de Vries')).toEqual({ firstName: 'Jan', lastName: 'de Vries' })
  })
  // A lone word goes wholly into lastName.
  it('puts a single word in lastName', () => {
    expect(splitContactName('Jansen')).toEqual({ firstName: '', lastName: 'Jansen' })
  })
  // Nothing typed means nothing fabricated: both parts stay empty.
  it('returns empty parts for empty or whitespace input', () => {
    expect(splitContactName('')).toEqual({ firstName: '', lastName: '' })
    expect(splitContactName('   ')).toEqual({ firstName: '', lastName: '' })
  })
  // Runs of spaces split like single spaces; outer whitespace is trimmed.
  it('collapses inner and outer whitespace', () => {
    expect(splitContactName('  Jan   de   Vries  ')).toEqual({ firstName: 'Jan', lastName: 'de Vries' })
  })
})

describe('quickContactPayload', () => {
  // The quick-create payload carries the split name and every other field at its default.
  it('builds the full payload with defaults', () => {
    expect(quickContactPayload('Jan de Vries', 'j@x.nl', '0612345678')).toEqual({
      firstName: 'Jan', lastName: 'de Vries', middleName: '', email: 'j@x.nl', phone: '0612345678', mobile: '',
      linkedin: '', gender: '', role: '', locationId: null, departmentId: null, locationIds: [], departmentIds: [],
      statusId: null, isPrimary: false, customFields: {},
    })
  })
})
