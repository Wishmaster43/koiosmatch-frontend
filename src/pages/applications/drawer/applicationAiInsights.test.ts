import { describe, it, expect, vi } from 'vitest'
import { buildApplicationAdviceInsights, resolveAdviceReason } from './applicationAiInsights'
import type { ApplicationDetail } from '@/types/application'

// Fake translate: returns the bare key, or "key|{...opts}" when interpolated.
const t = (key: string, opts?: Record<string, unknown>) => (opts ? `${key}|${JSON.stringify(opts)}` : key)

// Minimal ApplicationDetail stub — only the fields the builder reads.
const base = (over: Partial<ApplicationDetail> = {}) => ({
  created: '', phaseKey: 'applied', phaseLabel: '', bucket: 'active',
  vacancyId: 'vac-1', vacancy: { id: 'vac-1' },
  ...over,
} as unknown as ApplicationDetail)

describe('buildApplicationAdviceInsights', () => {
  it('clamps a future created date to 0 days instead of reporting the progress as unknown', () => {
    const now = new Date('2026-07-14T00:00:00Z')
    const a = base({ created: '2026-07-20T00:00:00Z', phaseLabel: 'Voorgesteld' })
    const [progress] = buildApplicationAdviceInsights(a, t, now)
    expect(progress.text).toBe('ai.progressOk|{"days":0,"phase":"Voorgesteld"}')
  })

  it('flags a stale non-terminal application past 14 days', () => {
    const now = new Date('2026-07-14T00:00:00Z')
    const a = base({ created: '2026-06-01T00:00:00Z', phaseLabel: 'Voorgesteld' })
    const [progress] = buildApplicationAdviceInsights(a, t, now)
    expect(progress.color).toBe('var(--color-warning)')
    expect(progress.text).toBe('ai.progressStale|{"days":43,"phase":"Voorgesteld"}')
  })

  it('does not flag a matched application even when it is old', () => {
    const now = new Date('2026-07-14T00:00:00Z')
    const a = base({ created: '2026-01-01T00:00:00Z', bucket: 'matched', phaseLabel: 'Aangenomen' })
    const [progress] = buildApplicationAdviceInsights(a, t, now)
    expect(progress.color).toBe('var(--color-secondary)')
    expect(progress.text).toContain('ai.progressOk')
  })

  it('adds a missing-vacancy completeness warning when no vacancy is linked', () => {
    const a = base({ vacancyId: null, vacancy: undefined })
    const insights = buildApplicationAdviceInsights(a, t)
    expect(insights).toHaveLength(2)
    expect(insights[1]).toMatchObject({ type: 'ai.completeness', text: 'ai.missingVacancy' })
  })

  it('skips the completeness insight once a vacancy is linked', () => {
    const insights = buildApplicationAdviceInsights(base(), t)
    expect(insights).toHaveLength(1)
  })

  it('never invents a phase-progress date when created is missing', () => {
    const [progress] = buildApplicationAdviceInsights(base({ created: '' }), t)
    expect(progress.text).toBe("ai.progressUnknown|{\"phase\":\"applied\"}")
  })

  // KOIOS-ADVIES-OVERAL-1: the AI-task advice row moved OUT of this builder to
  // the table's own resolver (useApplicationAdvice → adviceInsightRows, prepended
  // by ContextSubTab) — the builder emitting it too would render the advice twice.
  it('never emits the AI task itself — that row comes from the shared table resolver', () => {
    const insights = buildApplicationAdviceInsights(base({ task: 'Bel de kandidaat terug' }), t)
    expect(insights.every(i => i.text !== 'Bel de kandidaat terug' && i.type !== 'drawer.task')).toBe(true)
  })
})

// DEMO-TAAL (CMBE 7f10f04c): the advice sentence is key-driven with the server
// sentence as the fallback for older payloads — and never a raw t() of an unknown key.
describe('resolveAdviceReason', () => {
  const t = vi.fn((key: string, opts?: Record<string, unknown>) => `${key}|${String(opts?.criterion ?? '')}|${String(opts?.defaultValue ?? '')}`)

  it('translates a known key with the failed criterion and the server sentence as defaultValue', () => {
    const out = resolveAdviceReason({ advice: 'reject', advice_reason: 'Hard criterium niet gehaald: BIG.', advice_reason_key: 'hard_fail', advice_reason_criterion: 'BIG' }, t)
    expect(out).toBe('rejection.adviceReasons.hard_fail|BIG|Hard criterium niet gehaald: BIG.')
  })

  it('falls back to the server sentence when no key came along', () => {
    expect(resolveAdviceReason({ advice: 'reject', advice_reason: 'Lage match op de geconfigureerde criteria.' }, t)).toBe('Lage match op de geconfigureerde criteria.')
  })

  it('returns null when there is no advice at all', () => {
    expect(resolveAdviceReason(undefined, t)).toBeNull()
    expect(resolveAdviceReason({ advice: 'proceed' }, t)).toBeNull()
  })
})
