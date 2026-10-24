// smCandidateFields · erasedAtOf — the erased marker of an SM employee (ONIX H-003, decision 10g; SHARED-UNIT-TEST-1).
import { describe, it, expect } from 'vitest'
import { erasedAtOf } from './smCandidateFields'
import { formatDateOnly } from '@/lib/localDate'

describe('erasedAtOf', () => {
  it('returns the erased_at timestamp the resource sends', () => {
    expect(erasedAtOf({ id: '1', erased_at: '2026-10-23T10:00:00Z' })).toBe('2026-10-23T10:00:00Z')
    expect(formatDateOnly(erasedAtOf({ id: '1', erased_at: '2026-10-23T10:00:00Z' }))).toBe('23-10-2026')
  })

  it('reads a camelCase mirror too, like the other tolerant readers', () => {
    expect(erasedAtOf({ id: '1', erasedAt: '2026-10-23T10:00:00Z' })).toBe('2026-10-23T10:00:00Z')
  })

  it('reads a live record (null, empty or absent) as not erased', () => {
    expect(erasedAtOf({ id: '1', erased_at: null })).toBeNull()
    expect(erasedAtOf({ id: '1', erased_at: '' })).toBeNull()
    expect(erasedAtOf({ id: '1' })).toBeNull()
  })
})
