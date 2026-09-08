import { describe, it, expect, vi } from 'vitest'
import type { TFunction } from 'i18next'
import { reasonBreakdown } from './bulkSkipReasons'

describe('reasonBreakdown', () => {
  // Mock t function that returns the default value with a 'mock-' prefix for verification
  const mockT = vi.fn((key: string, options?: { defaultValue?: string }) => {
    if (options?.defaultValue) {
      return options.defaultValue
    }
    return key
  }) as unknown as TFunction

  it('groups reasoned rows by reason and formats as "count reason"', () => {
    const skipped = [
      { id: '1', reason: 'not_found' },
      { id: '2', reason: 'not_found' },
      { id: '3', reason: 'permission_denied' },
    ]
    const result = reasonBreakdown(skipped, mockT)
    expect(result).toBe('2 not_found, 1 permission_denied')
  })

  it('calls t with bulk.skipReasons.<reason> key and defaultValue', () => {
    const skipped = [{ id: '1', reason: 'test_reason' }]
    reasonBreakdown(skipped, mockT)
    expect(mockT).toHaveBeenCalledWith(
      'bulk.skipReasons.test_reason',
      { defaultValue: 'test_reason' },
    )
  })

  it('returns empty string when no rows have a reason', () => {
    const skipped = [
      { id: '1' },
      { id: '2' },
    ]
    const result = reasonBreakdown(skipped, mockT)
    expect(result).toBe('')
  })

  it('returns empty string when reason is empty string', () => {
    const skipped = [
      { id: '1', reason: '' },
      { id: '2', reason: '' },
    ]
    const result = reasonBreakdown(skipped, mockT)
    expect(result).toBe('')
  })

  it('returns empty string when skipped is undefined', () => {
    const result = reasonBreakdown(undefined, mockT)
    expect(result).toBe('')
  })

  it('returns empty string when skipped is empty array', () => {
    const result = reasonBreakdown([], mockT)
    expect(result).toBe('')
  })

  it('ignores rows without reason field', () => {
    const skipped: unknown[] = [
      { id: '1', code: 'some_code' },
      { id: '2', reason: 'has_reason' },
      { id: '3' },
    ]
    const result = reasonBreakdown(skipped, mockT)
    expect(result).toBe('1 has_reason')
  })

  it('ignores non-string reason values', () => {
    const skipped: unknown[] = [
      { id: '1', reason: 123 },
      { id: '2', reason: null },
      { id: '3', reason: 'valid_reason' },
    ]
    const result = reasonBreakdown(skipped, mockT)
    expect(result).toBe('1 valid_reason')
  })

  it('ignores non-object items in array', () => {
    const skipped: unknown[] = [
      'string',
      123,
      null,
      { id: '1', reason: 'test_reason' },
    ]
    const result = reasonBreakdown(skipped, mockT)
    expect(result).toBe('1 test_reason')
  })

  it('orders reasons by their first appearance in Object.entries iteration', () => {
    const skipped = [
      { id: '1', reason: 'reason_a' },
      { id: '2', reason: 'reason_b' },
      { id: '3', reason: 'reason_a' },
    ]
    const result = reasonBreakdown(skipped, mockT)
    expect(result).toBe('2 reason_a, 1 reason_b')
  })

  it('handles mixed valid and invalid items', () => {
    const skipped: unknown[] = [
      { id: '1', reason: 'valid' },
      { id: '2', reason: '' },
      { id: '3' },
      null,
      { id: '4', reason: 'valid' },
    ]
    const result = reasonBreakdown(skipped, mockT)
    expect(result).toBe('2 valid')
  })
})
