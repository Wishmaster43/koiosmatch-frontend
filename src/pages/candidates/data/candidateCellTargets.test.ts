import { describe, it, expect } from 'vitest'
import { contactTarget, funnelTarget, statusTarget, TARGET_NOTES, TARGET_CONVERSATIONS, TARGET_APPLICATIONS, TARGET_MATCHES, TARGET_PREFERENCES } from './candidateCellTargets'

// contactTarget: only the documented "whatsapp" substring changes the target,
// case-insensitively; every other channel (incl. undefined) falls to Notities.
describe('contactTarget', () => {
  it.each([
    ['whatsapp', TARGET_CONVERSATIONS],
    ['whatsapp_private', TARGET_CONVERSATIONS],
    ['WhatsApp', TARGET_CONVERSATIONS],
    ['phone', TARGET_NOTES],
    ['email', TARGET_NOTES],
    ['appointment', TARGET_NOTES],
    ['note', TARGET_NOTES],
    ['some_renamed_slug', TARGET_NOTES],
    [null, TARGET_NOTES],
    [undefined, TARGET_NOTES],
  ])('%s -> %s', (input, expected) => {
    expect(contactTarget(input as string | null | undefined)).toBe(expected)
  })
})

// funnelTarget: driven purely by is_match, never by label/slug — a renamed
// "Aangenomen" stage (or any stage carrying the flag) still opens Matches.
describe('funnelTarget', () => {
  it('opens Matches when is_match is true', () => {
    expect(funnelTarget({ is_match: true })).toBe(TARGET_MATCHES)
  })
  it('opens Applications when is_match is false', () => {
    expect(funnelTarget({ is_match: false })).toBe(TARGET_APPLICATIONS)
  })
  it('opens Applications for a renamed stage with no is_match flag', () => {
    expect(funnelTarget({})).toBe(TARGET_APPLICATIONS)
  })
  it('opens Applications for null/undefined stage', () => {
    expect(funnelTarget(null)).toBe(TARGET_APPLICATIONS)
    expect(funnelTarget(undefined)).toBe(TARGET_APPLICATIONS)
  })
})

// statusTarget: requires_match wins over the other flags; any of
// requires_reason/expects_return_date/is_blacklist opens Preferences; no flag ->
// null (plain row click stays in charge); no status -> null.
describe('statusTarget', () => {
  it('returns Matches when requires_match is set', () => {
    expect(statusTarget({ requires_match: true })).toBe(TARGET_MATCHES)
  })
  it('returns Preferences when requires_reason is set', () => {
    expect(statusTarget({ requires_reason: true })).toBe(TARGET_PREFERENCES)
  })
  it('returns Preferences when expects_return_date is set', () => {
    expect(statusTarget({ expects_return_date: true })).toBe(TARGET_PREFERENCES)
  })
  it('returns Preferences when is_blacklist is set', () => {
    expect(statusTarget({ is_blacklist: true })).toBe(TARGET_PREFERENCES)
  })
  it('returns null when no flag is set (e.g. Beschikbaar)', () => {
    expect(statusTarget({})).toBeNull()
  })
  it('returns null for a renamed status with no matching flag', () => {
    expect(statusTarget({ requires_match: false, requires_reason: false })).toBeNull()
  })
  it('returns null for null/undefined status', () => {
    expect(statusTarget(null)).toBeNull()
    expect(statusTarget(undefined)).toBeNull()
  })
})
