import { describe, it, expect } from 'vitest'
import { targetLine, formatTargetLine, TILE_TARGET_KEY } from './kpiTargets'
import type { KpiTarget } from '@/types/dashboard'

const entry = (o: Partial<KpiTarget>): KpiTarget => ({ value: 4, target: 10, comparison: 'gte', below_target: true, metric: 'm', period_scope: 'month', ...o })

describe('targetLine', () => {
  it('returns null for absent, target-less or value-less entries', () => {
    expect(targetLine(undefined)).toBeNull()
    expect(targetLine(entry({ target: null }))).toBeNull()
    expect(targetLine(entry({ value: null, below_target: null }))).toBeNull()
  })
  it('classifies every branch', () => {
    expect(targetLine(entry({ below_target: null }))?.kind).toBe('monthOnly')
    expect(targetLine(entry({}))?.kind).toBe('progress')
    expect(targetLine(entry({ below_target: false }))?.kind).toBe('reached')
    expect(targetLine(entry({ comparison: 'lte', below_target: true }))?.kind).toBe('over')
    expect(targetLine(entry({ comparison: 'lte', below_target: false }))?.kind).toBe('within')
  })
  it('maps the five tiles to their setting keys', () => {
    expect(Object.keys(TILE_TARGET_KEY)).toHaveLength(5)
    expect(TILE_TARGET_KEY.fillRate).toBe('fill_rate_target')
  })
})

describe('formatTargetLine', () => {
  const args = { t: (k: string, o?: Record<string, unknown>) => `${k}|${o?.value}|${o?.target}`, num: (v?: number | null) => `n${v}`, pct: (v: number) => `${v}%` }
  it('tones: only reached and over are coloured; progress is muted', () => {
    expect(formatTargetLine({ kind: 'progress', value: 4, target: 10 }, false, args)).toEqual({ text: 'kpi.target.progress|n4|n10', tone: 'muted' })
    expect(formatTargetLine({ kind: 'reached', value: 12, target: 10 }, false, args).tone).toBe('success')
    expect(formatTargetLine({ kind: 'over', value: 12, target: 10 }, false, args).tone).toBe('warning')
  })
  it('uses the percent formatter for percentage tiles', () => {
    expect(formatTargetLine({ kind: 'progress', value: 40, target: 80 }, true, args).text).toBe('kpi.target.progress|40%|80%')
  })
})
