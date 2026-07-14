import { describe, it, expect } from 'vitest'
import { buildApplicationAdviceInsights } from './applicationAiInsights'
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
})
