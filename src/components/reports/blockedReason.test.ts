import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import type { RunRow } from '@/types/reports'
import { blockedReason } from './blockedReason'

// Key-echo t() stub, as in runReason.test.ts.
const mockT = ((key: string) => key) as TFunction
const run = (over: Record<string, unknown>) => ({ id: 'r', status: 'blocked', ...over }) as unknown as RunRow

describe('blockedReason', () => {
  it('returns null for a run that is not blocked', () => {
    expect(blockedReason(run({ status: 'success' }), mockT)).toBeNull()
  })

  it('translates the capped step reason code when t is given, else uses the message', () => {
    const r = run({ steps: [{ status: 'skipped', reason: 'cap_reached', message: 'Server sentence' }] })
    expect(blockedReason(r, mockT)).toBe('runs.stepReasons.cap_reached')
    expect(blockedReason(r)).toBe('Server sentence')
  })

  it('treats a skipped step with only a known reason code (no sentence) as the capped step', () => {
    const r = run({ steps: [{ status: 'skipped', reason: 'cap_reached' }], error_message: 'run level' })
    expect(blockedReason(r, mockT)).toBe('runs.stepReasons.cap_reached')
    // Without t the code is not readable, so the run-level message is the honest fallback.
    expect(blockedReason(r)).toBe('run level')
  })

  it('falls back to the message for an unknown reason code', () => {
    const r = run({ steps: [{ status: 'skipped', reason: 'future_code', message: 'Server sentence' }] })
    expect(blockedReason(r, mockT)).toBe('Server sentence')
  })

  it('prefers step_results over steps', () => {
    const r = run({
      step_results: [{ status: 'skipped', message: 'from results' }],
      steps: [{ status: 'skipped', message: 'from steps' }],
    })
    expect(blockedReason(r, mockT)).toBe('from results')
  })

  it('lets an empty-string message fall through to error', () => {
    const r = run({ steps: [{ status: 'skipped', message: '', error: 'the error' }] })
    expect(blockedReason(r, mockT)).toBe('the error')
  })

  it('uses run.error_message when no step is capped', () => {
    const r = run({ steps: [{ status: 'success' }], error_message: 'run level' })
    expect(blockedReason(r, mockT)).toBe('run level')
  })
})
