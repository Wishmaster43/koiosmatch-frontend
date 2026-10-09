import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import { runReasonLabel, RUN_REASON_CODES } from './runReason'

// Minimal t() stub mirroring the test pattern used elsewhere in this folder
// (reportFilterDefs.test.ts) — echoes the key so a known-code call is verifiable.
const mockT = ((key: string) => key) as TFunction

describe('runReasonLabel', () => {
  it('resolves a known code to its i18n key', () => {
    expect(runReasonLabel('rejected_stage', mockT)).toBe('runs.reasons.rejected_stage')
  })

  it('returns the raw code for an unknown/legacy code (never blank, never a raw i18n key path guess)', () => {
    expect(runReasonLabel('some_future_reason', mockT)).toBe('some_future_reason')
  })

  it('returns null for a null/empty reason', () => {
    expect(runReasonLabel(null, mockT)).toBeNull()
    expect(runReasonLabel(undefined, mockT)).toBeNull()
    expect(runReasonLabel('', mockT)).toBeNull()
  })

  it('covers every contract code from INTERVIEW-KICKOFF-VACANCY-1', () => {
    expect(RUN_REASON_CODES).toHaveLength(19)
    for (const code of RUN_REASON_CODES) {
      expect(runReasonLabel(code, mockT)).toBe(`runs.reasons.${code}`)
    }
  })
})
