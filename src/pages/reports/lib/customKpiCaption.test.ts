/**
 * customKpiCaption — asserts the joined caption string per status/target/warn
 * combination, using a minimal `t` stub that mirrors the real i18n interpolation.
 */
import { describe, it, expect } from 'vitest'
import { customKpiCaption } from './customKpiCaption'
import type { CustomKpiCard } from '@/types/analytics'
import type { TFunction } from 'i18next'

// Minimal t() stub: returns the key with any {{value}} interpolated, matching
// the real i18next behaviour closely enough for a pure-function test.
const t = ((key: string, opts?: { value?: string }) =>
  opts?.value != null ? `${key}:${opts.value}` : key) as unknown as TFunction

const baseCard: CustomKpiCard = {
  id: 'kd-1', entity: 'match', metric_key: 'new_in_period', label: 'Nieuwe matches',
  dimension: 'all', dimension_value: null, dimension_label: null,
  value: 14, unit: 'count', target: null, warn: null, comparison: 'gte', status: 'ok',
}

describe('customKpiCaption', () => {
  it('returns undefined when ok with no comparison and no target/warn', () => {
    const card = { ...baseCard, comparison: 'none' as const }
    expect(customKpiCaption({ card, t, formatValue: String })).toBeUndefined()
  })

  it('includes the status word for ok WITH a target configured (§6: colour is never the only signal)', () => {
    const card = { ...baseCard, target: 10 }
    const result = customKpiCaption({ card, t, formatValue: String })
    expect(result).toBe('analytics:customKpi.status.ok · analytics:customKpi.target:10')
  })

  it('returns undefined for status none (no comparison configured, no target/warn)', () => {
    // deriveStatus (BE KpiResolver) returns 'none' whenever value is null, comparison
    // is 'none', or neither target nor warn is set — a thresholdless card says nothing.
    const card = { ...baseCard, status: 'none' as const, comparison: 'none' as const }
    expect(customKpiCaption({ card, t, formatValue: String })).toBeUndefined()
  })

  it('joins status word + target caption for alert', () => {
    const card = { ...baseCard, status: 'alert' as const, target: 15 }
    const result = customKpiCaption({ card, t, formatValue: (v) => String(v) })
    expect(result).toBe('analytics:customKpi.status.alert · analytics:customKpi.target:15')
  })

  it('includes both target and warn captions when both are set', () => {
    const card = { ...baseCard, status: 'warn' as const, target: 15, warn: 10 }
    const result = customKpiCaption({ card, t, formatValue: (v) => String(v) })
    expect(result).toBe(
      'analytics:customKpi.status.warn · analytics:customKpi.target:15 · analytics:customKpi.warn:10',
    )
  })
})
