/**
 * orderKpis — the tenant's stored KPI order picks and arranges the cards; unknown keys drop out.
 */
import { describe, it, expect } from 'vitest'
import { orderKpis } from './kpiOrder'
import type { KpiSpec } from '@/components/insights/InsightsRow'

const spec = (key: string) => ({ key, label: key, value: 1 }) as unknown as KpiSpec

describe('orderKpis', () => {
  it('returns the specs in the stored order and skips keys without a spec', () => {
    const byKey = { a: spec('a'), b: spec('b'), c: spec('c') }
    expect(orderKpis(['c', 'x', 'a'], byKey).map(k => k.key)).toEqual(['c', 'a'])
    expect(orderKpis([], byKey)).toEqual([])
  })
})
