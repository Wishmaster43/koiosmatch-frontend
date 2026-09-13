import { describe, it, expect, vi } from 'vitest'
import { completenessInsight } from './completenessInsight'

describe('completenessInsight', () => {
  const t = vi.fn((key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key))

  it('reports the default complete-good key at/above 80%', () => {
    const insight = completenessInsight([1, 1, 1, 1], t)
    expect(insight.text).toBe('ai.completeGood')
    expect(insight.color).toBe('var(--color-success)')
  })

  it('reports the default partial key with the rounded percentage below 80%', () => {
    const insight = completenessInsight([1, 0, 0, 0], t)
    expect(insight.text).toBe('ai.completePartial:{"pct":25}')
    expect(insight.color).toBe('var(--color-warning)')
  })

  it('uses entity-specific keys when passed', () => {
    const insight = completenessInsight([1], t, { good: 'ai.locationComplete', partial: 'ai.locationPartial' })
    expect(insight.text).toBe('ai.locationComplete')
  })
})
