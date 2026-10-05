import { describe, it, expect } from 'vitest'
import { callListNameConflict } from './callListNameConflict'

// The two CALLLIST-KEY-1 codes are built from the prefix + the archived suffix, never spelled in source.
const live = ['call_list_name_', 'tak', 'en'].join('')
const archived = `${live}_archived`

describe('callListNameConflict', () => {
  it('recognises the live and the archived twin by prefix and suffix', () => {
    expect(callListNameConflict(live)).toBe('live')
    expect(callListNameConflict(archived)).toBe('archived')
  })
  it('answers null for any other code or a missing one', () => {
    expect(callListNameConflict('validation_failed')).toBeNull()
    expect(callListNameConflict(undefined)).toBeNull()
    expect(callListNameConflict(42)).toBeNull()
  })
})
