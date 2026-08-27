/**
 * koiosModelTiers — id→tier substring matching (K-37). Covers every entry in the
 * backend whitelist (config/koios_ai.php) plus the honest null fallback for an
 * unmapped id, since callers rely on that null to fall back to the raw id instead
 * of inventing a label.
 */
import { describe, it, expect } from 'vitest'
import { tierKeyForModel } from './koiosModelTiers'

describe('tierKeyForModel', () => {
  it('maps haiku ids to fast', () => {
    expect(tierKeyForModel('claude-haiku-4-5')).toBe('fast')
  })

  it('maps sonnet ids to smart', () => {
    expect(tierKeyForModel('claude-sonnet-5')).toBe('smart')
  })

  it('maps opus and fable ids to max', () => {
    expect(tierKeyForModel('claude-opus-4-8')).toBe('max')
    expect(tierKeyForModel('claude-fable-5')).toBe('max')
  })

  it('returns null for an unmapped id or a missing value — never a guessed label', () => {
    expect(tierKeyForModel('gpt-4o')).toBeNull()
    expect(tierKeyForModel(null)).toBeNull()
    expect(tierKeyForModel(undefined)).toBeNull()
    expect(tierKeyForModel('')).toBeNull()
  })
})
