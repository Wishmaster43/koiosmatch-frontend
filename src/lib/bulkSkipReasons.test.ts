import { describe, it, expect, vi } from 'vitest'
import type { TFunction } from 'i18next'
import { reasonBreakdown } from './bulkSkipReasons'

describe('reasonBreakdown', () => {
  // Key-echo t: returns the bare reason so the grouping stays readable (the key shape is asserted below).
  const mockT = vi.fn((key: string) => key.replace('bulk.skipReasons.', '')) as unknown as TFunction

  it('groups reasoned rows by reason and formats as "count reason"', () => {
    const skipped = [
      { id: '1', reason: 'not_found' },
      { id: '2', reason: 'not_found' },
      { id: '3', reason: 'permission_denied' },
    ]
    const result = reasonBreakdown(skipped, mockT)
    expect(result).toBe('2 not_found, 1 permission_denied')
  })

  it('calls t with the bulk.skipReasons.<reason> key and no defaultValue', () => {
    const skipped = [{ id: '1', reason: 'test_reason' }]
    reasonBreakdown(skipped, mockT)
    expect(mockT).toHaveBeenCalledWith('bulk.skipReasons.test_reason')
  })

  // Applications bulk sends {reason: <server sentence>, code: 'guard_blocked'}: the code groups the
  // rows, the sentence is shown when no key exists for the code (no raw key, no defaultValue).
  it('shows the server sentence for a coded row whose key is missing, and the label when it exists', () => {
    const t = ((k: string) => (k === 'bulk.skipReasons.validation' ? 'validatie mislukt' : k)) as unknown as TFunction
    const skipped = [
      { id: '1', reason: 'Fase overslaan is niet toegestaan.', code: 'guard_blocked' },
      { id: '2', reason: 'Fase overslaan is niet toegestaan.', code: 'guard_blocked' },
      { id: '3', reason: 'Het veld e-mail is verplicht.', code: 'validation' },
    ]
    expect(reasonBreakdown(skipped, t)).toBe('2 Fase overslaan is niet toegestaan., 1 validatie mislukt')
  })

  it('groups by reason_code when present, falling back to reason', () => {
    const keyEcho = ((k: string) => k) as unknown as TFunction
    const skipped = [
      { id: '1', reason: 'needs_contract_fields', reason_code: 'helloflex_start_date_missing' },
      { id: '2', reason: 'needs_contract_fields', reason_code: 'helloflex_start_date_missing' },
      { id: '3', reason: 'needs_contract_fields', reason_code: 'helloflex_branch_unlinked' },
      { id: '4', reason: 'already_coupled' },
    ]
    expect(reasonBreakdown(skipped, keyEcho)).toBe(
      '2 bulk.skipReasons.helloflex_start_date_missing, 1 bulk.skipReasons.helloflex_branch_unlinked, 1 bulk.skipReasons.already_coupled',
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
