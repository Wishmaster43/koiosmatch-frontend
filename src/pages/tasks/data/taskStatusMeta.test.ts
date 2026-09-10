// taskStatusMeta — object vs plain-string status shapes, and the muted-text
// fallback color (DRY round 11, NOTES2).
import { describe, it, expect } from 'vitest'
import { taskStatusMeta } from './taskStatusMeta'

describe('taskStatusMeta', () => {
  it('reads label/color off an object status', () => {
    expect(taskStatusMeta({ label: 'Open', color: 'teal' })).toEqual({ label: 'Open', color: 'teal' })
  })

  it('falls back to the muted text color when the object carries none', () => {
    expect(taskStatusMeta({ label: 'Open' })).toEqual({ label: 'Open', color: 'var(--text-muted)' })
  })

  it('treats a plain string status as the label, with the muted fallback color', () => {
    expect(taskStatusMeta('Open')).toEqual({ label: 'Open', color: 'var(--text-muted)' })
  })

  it('returns an undefined label for a null/undefined status', () => {
    expect(taskStatusMeta(null)).toEqual({ label: undefined, color: 'var(--text-muted)' })
    expect(taskStatusMeta(undefined)).toEqual({ label: undefined, color: 'var(--text-muted)' })
  })
})
