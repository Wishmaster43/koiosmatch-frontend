import { describe, it, expect } from 'vitest'
import nl from '@/i18n/locales/nl/dashboard.json'
import en from '@/i18n/locales/en/dashboard.json'
import de from '@/i18n/locales/de/dashboard.json'
import fr from '@/i18n/locales/fr/dashboard.json'
import es from '@/i18n/locales/es/dashboard.json'
import it_ from '@/i18n/locales/it/dashboard.json'
import pt from '@/i18n/locales/pt/dashboard.json'
import { targetLine, formatTargetLine, TILE_TARGET_KEY, TARGET_LINE_KINDS } from './kpiTargets'
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

// #6/#172/#125/#359/#360: every kind resolves in all seven locales and carries both numbers.
describe('kpi.target locale strings', () => {
  const BUNDLES: Record<string, { kpi: { target: Record<string, string> } }> = { nl, en, de, fr, es, it: it_, pt }
  const LOCALES = Object.keys(BUNDLES)
  const read = (l: string) => BUNDLES[l].kpi.target
  it.each(LOCALES)('%s has every kind with {{value}} and {{target}}', l => {
    const target = read(l)
    for (const kind of TARGET_LINE_KINDS) {
      expect(target[kind], `${l}:${kind}`).toBeTruthy()
      expect(target[kind]).toContain('{{value}}')
      expect(target[kind]).toContain('{{target}}')
    }
  })
  it('a lte entry without a verdict is the ceiling kind, not a monthly goal; null value draws nothing', () => {
    expect(targetLine(entry({ comparison: 'lte', below_target: null }))?.kind).toBe('monthOnlyMax')
    expect(targetLine(entry({ comparison: 'gte', below_target: null }))?.kind).toBe('monthOnly')
    expect(targetLine(entry({ value: null }))).toBeNull()
  })
  it('formatTargetLine renders the formatted value for each kind', () => {
    const args = { t: (k: string, o?: Record<string, unknown>) => `${k}|${o?.value}|${o?.target}`, num: (v?: number | null) => `n${v}`, pct: (v: number) => `${v}%` }
    for (const kind of TARGET_LINE_KINDS) expect(formatTargetLine({ kind, value: 22, target: 30 }, false, args).text).toContain('|n22|')
  })
})
