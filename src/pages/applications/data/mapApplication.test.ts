import { describe, it, expect } from 'vitest'
import { mapApplication } from './mapApplication'
import type { LookupItem } from '@/context/LookupsContext'

// A tenant that renamed the funnel: 'aangenomen' carries is_match — proves the
// mapped `bucket` is flag-driven, never the literal 'hired' slug (A1).
const RENAMED_FUNNEL: LookupItem[] = [
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  { value: 'aangenomen', label: 'Aangenomen', color: '#79B58E', is_match: true },
]

describe('mapApplication', () => {
  it('maps the owner id from a nested owner object', () => {
    expect(mapApplication({ id: 1, owner: { id: 'u7', name: 'Bente de Jong' } }).owner.id).toBe('u7')
  })

  it('falls back to owner_id when the owner object has none', () => {
    expect(mapApplication({ id: 2, owner_id: 'u9', owner_name: 'Kelly van Vliet' }).owner.id).toBe('u9')
  })

  it('leaves the owner id null when nothing is provided', () => {
    expect(mapApplication({ id: 3 }).owner.id).toBeNull()
  })

  it('derives owner initials from the first two words of the name', () => {
    expect(mapApplication({ id: 4, owner: { name: 'Bente de Jong' } }).owner.initials).toBe('BD')
  })

  it('falls back to a dash when no candidate name is present', () => {
    expect(mapApplication({ id: 5 }).candidateName).toBe('—')
  })

  it('derives the bucket off the funnel lookup flags, not a hardcoded phase key', () => {
    expect(mapApplication({ id: 6, phase_key: 'aangenomen' }, RENAMED_FUNNEL).bucket).toBe('matched')
    // Without a matching lookup entry, an unknown key is never assumed "matched".
    expect(mapApplication({ id: 7, phase_key: 'aangenomen' }).bucket).toBe('active')
  })
})
