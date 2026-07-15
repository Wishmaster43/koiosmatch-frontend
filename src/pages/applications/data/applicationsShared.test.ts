import { describe, it, expect } from 'vitest'
import { bucketOfPhase } from './applicationsShared'
import type { LookupItem } from '@/context/LookupsContext'

// A tenant that renamed the funnel: 'hired' → 'aangenomen' (is_match) and
// 'rejected' → 'afgewezen' (is_rejected) — proves the bucket derives from the
// FLAG, never the literal 'hired'/'rejected' slug (A1 root-cause fix).
const RENAMED_FUNNEL: LookupItem[] = [
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  { value: 'applied', label: 'Gesolliciteerd', color: '#94A3B8' },
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  { value: 'aangenomen', label: 'Aangenomen', color: '#79B58E', is_match: true },
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  { value: 'afgewezen', label: 'Afgewezen', color: '#D98A8A', is_rejected: true },
]

describe('bucketOfPhase', () => {
  it('is flag-driven: resolves matched/rejected off is_match/is_rejected under a renamed funnel', () => {
    expect(bucketOfPhase('aangenomen', RENAMED_FUNNEL)).toBe('matched')
    expect(bucketOfPhase('afgewezen', RENAMED_FUNNEL)).toBe('rejected')
    expect(bucketOfPhase('applied', RENAMED_FUNNEL)).toBe('active')
  })

  it('does not special-case the literal "hired"/"rejected" slug once a lookup is passed', () => {
    // Under the renamed funnel, 'hired' isn't a known value — it must NOT be
    // treated as matched just because it used to be the hardcoded key.
    expect(bucketOfPhase('hired', RENAMED_FUNNEL)).toBe('active')
  })

  it('falls back to the seed slugs when no lookup is available (pure-mapper safety net)', () => {
    expect(bucketOfPhase('hired')).toBe('matched')
    expect(bucketOfPhase('rejected')).toBe('rejected')
    expect(bucketOfPhase('applied')).toBe('active')
  })
})
