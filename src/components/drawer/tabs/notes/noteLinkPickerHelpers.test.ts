// Tests for NoteLinkPicker's contact option label, which delegates to the
// shared lib/contactLabel builder (house "Name — Function" separator).
import { describe, it, expect } from 'vitest'
import { contactLabel, PRINCIPAL_ENDPOINTS } from './noteLinkPickerHelpers'

describe('contactLabel', () => {
  it('appends the job function when the row carries one', () => {
    expect(contactLabel({ name: 'Jan Jansen', function: 'HR Manager' })).toBe('Jan Jansen — HR Manager')
  })

  it('renders just the name when no function is present', () => {
    expect(contactLabel({ name: 'Jan Jansen' })).toBe('Jan Jansen')
  })
})

// Seam test for NoteLinkPicker's contact wiring (mirrors taskLinkTypes.test.ts's
// TASK_LINK_ENDPOINTS.contact assertions) — proves the `contact` principal's
// label function is actually the shared builder, not just that the pure
// helper works in isolation (§13: a test must raise the seam).
describe('PRINCIPAL_ENDPOINTS.contact', () => {
  it('labels a contact with its job function when present, name-only otherwise (shared lib/contactLabel)', () => {
    expect(PRINCIPAL_ENDPOINTS.contact.label({ id: '1', name: 'Jan Jansen', function: 'HR Manager' })).toBe('Jan Jansen — HR Manager')
    expect(PRINCIPAL_ENDPOINTS.contact.label({ id: '1', name: 'Jan Jansen' })).toBe('Jan Jansen')
  })
})
