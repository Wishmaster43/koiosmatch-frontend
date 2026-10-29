import { describe, it, expect } from 'vitest'
import { safeEmailParam } from './safeEmailParam'

describe('safeEmailParam', () => {
  it('keeps a valid address', () => { expect(safeEmailParam('u@x.nl')).toBe('u@x.nl') })
  it('rejects a sentence', () => { expect(safeEmailParam('Call me now')).toBe('') })
  it('rejects an over-long value', () => { expect(safeEmailParam(`${'a'.repeat(250)}@x.nl`)).toBe('') })
  it('rejects null and empty input', () => {
    expect(safeEmailParam(null)).toBe('')
    expect(safeEmailParam('')).toBe('')
  })
})
