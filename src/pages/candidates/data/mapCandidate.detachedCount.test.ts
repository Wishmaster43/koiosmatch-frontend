/**
 * mapCandidate · ONTKOPPEL-TELLER-1 — the detail-only, server-computed count of
 * applications CURRENTLY detached (soft-deleted, not restored). Whole-history,
 * never the screen's active filter window; hidden by the badge at 0/undefined.
 */
import { describe, it, expect } from 'vitest'
import { mapCandidate } from './mapCandidate'
import type { ApiCandidate } from '@/types/candidate'

describe('mapCandidate · detachedCount', () => {
  it('reads detached_count from the API payload', () => {
    const c = mapCandidate({ id: 1, name: 'Jan Jansen', detached_count: 3 } as ApiCandidate)
    expect(c.detachedCount).toBe(3)
  })

  it('leaves detachedCount undefined when the field is absent, never a fabricated 0', () => {
    const c = mapCandidate({ id: 1, name: 'Jan Jansen' } as ApiCandidate)
    expect(c.detachedCount).toBeUndefined()
  })

  it('coerces a string-numeric field to a real number', () => {
    const c = mapCandidate({ id: 1, name: 'Jan Jansen', detached_count: '2' } as unknown as ApiCandidate)
    expect(c.detachedCount).toBe(2)
  })
})
