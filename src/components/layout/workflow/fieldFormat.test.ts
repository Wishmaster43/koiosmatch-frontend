/**
 * Unit tests for the |format split/join helpers — the round-trip the "Toon als"
 * picker relies on to parse an existing suffix back when editing a saved filter.
 */
import { describe, it, expect } from 'vitest'
import { splitFieldFormat, joinFieldFormat } from './fieldFormat'

describe('splitFieldFormat', () => {
  it('splits a Make-style "path|format" expression on the first pipe', () => {
    expect(splitFieldFormat('shift.start_time|H:i')).toEqual({ path: 'shift.start_time', format: 'H:i' })
  })

  it('a bare path has no format', () => {
    expect(splitFieldFormat('status')).toEqual({ path: 'status', format: '' })
  })

  it('trims whitespace around both halves', () => {
    expect(splitFieldFormat(' now | H:i ')).toEqual({ path: 'now', format: 'H:i' })
  })
})

describe('joinFieldFormat', () => {
  it('recombines a path + format into the stored expression', () => {
    expect(joinFieldFormat('shift.start_time', 'H:i')).toBe('shift.start_time|H:i')
  })

  it('an empty format yields the bare path (no trailing pipe)', () => {
    expect(joinFieldFormat('status', '')).toBe('status')
  })

  it('round-trips through split', () => {
    const expr = 'available_from|d-m-Y'
    const { path, format } = splitFieldFormat(expr)
    expect(joinFieldFormat(path, format)).toBe(expr)
  })
})
