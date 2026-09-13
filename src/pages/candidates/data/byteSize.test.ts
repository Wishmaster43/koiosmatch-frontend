import { describe, it, expect } from 'vitest'
import { formatByteSize } from './byteSize'

describe('formatByteSize', () => {
  it('renders bytes, KB and MB thresholds', () => {
    expect(formatByteSize(500)).toBe('500 B')
    expect(formatByteSize(2048)).toBe('2 KB')
    expect(formatByteSize(2 * 1024 * 1024, 'nl-NL')).toBe('2 MB')
  })

  it('returns empty string for null/empty input', () => {
    expect(formatByteSize(null)).toBe('')
    expect(formatByteSize('')).toBe('')
  })

  it('leaves an already-formatted string alone only when skipIfFormatted is set', () => {
    expect(formatByteSize('740 KB', 'nl-NL', true)).toBe('740 KB')
    // Without the flag (mapCandidate's use), a formatted string is not re-parsed as a number either — falls back to String(b).
    expect(formatByteSize('740 KB', 'nl-NL', false)).toBe('740 KB')
  })
})
