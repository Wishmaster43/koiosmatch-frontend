// changelogScrub — unit tests for the K004-AUDIT-SCRUB-1 marker helpers.
import { describe, it, expect } from 'vitest'
import { isScrubbedActivity, scrubbedBagOf, scrubReasonKey } from './changelogScrub'
import type { ChangelogEvent } from './EntityChangelogTab'

describe('isScrubbedActivity', () => {
  it('is true for a bag carrying scrubbed: true', () => {
    expect(isScrubbedActivity({ scrubbed: true, reason: 'avg_erasure_request' })).toBe(true)
  })

  it('is false for a normal { attributes, old } diff bag', () => {
    expect(isScrubbedActivity({ attributes: { first_name: 'X' }, old: {} })).toBe(false)
  })

  it('is false for null/undefined/non-object input', () => {
    expect(isScrubbedActivity(null)).toBe(false)
    expect(isScrubbedActivity(undefined)).toBe(false)
    expect(isScrubbedActivity('scrubbed')).toBe(false)
    expect(isScrubbedActivity([])).toBe(false)
  })
})

describe('scrubbedBagOf', () => {
  it('reads the marker off properties first', () => {
    const ev: ChangelogEvent = { properties: { scrubbed: true, reason: 'avg_erasure_request' } }
    expect(scrubbedBagOf(ev)).toEqual({ scrubbed: true, reason: 'avg_erasure_request' })
  })

  it('falls back to changes when properties carries no marker', () => {
    const ev: ChangelogEvent = { changes: { scrubbed: true, reason: 'avg_erasure_request' } }
    expect(scrubbedBagOf(ev)).toEqual({ scrubbed: true, reason: 'avg_erasure_request' })
  })

  it('returns undefined for a normal diff event', () => {
    const ev: ChangelogEvent = { changes: { attributes: { first_name: 'X' }, old: {} } }
    expect(scrubbedBagOf(ev)).toBeUndefined()
  })
})

describe('scrubReasonKey', () => {
  it('maps the AVG-erasure reason to its own key', () => {
    expect(scrubReasonKey('avg_erasure_request')).toBe('changelog.scrubbedErasure')
  })

  it('maps any other reason (or none) to the generic key', () => {
    expect(scrubReasonKey('something_else')).toBe('changelog.scrubbed')
    expect(scrubReasonKey(undefined)).toBe('changelog.scrubbed')
  })
})
