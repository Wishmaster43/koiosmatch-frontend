/**
 * KPI target fields (BE lane L, M2): a stored 0 means "not set", so every target
 * field has min 1 (clearing sends empty); defaults and the fill-rate max stay.
 */
import { describe, it, expect } from 'vitest'
import * as schemas from './kpis'

const TARGETS = {
  new_candidates_target: 15,
  open_tasks_target: 20,
  daily_calls_target: 20,
  uncalled_warning_threshold: 25,
  placements_target: 10,
  fill_rate_target: 85,
}

// Collect every field of every exported schema (fields may be nested in sections).
const collect = (node, out = []) => {
  if (Array.isArray(node)) node.forEach((n) => collect(n, out))
  else if (node && typeof node === 'object') {
    if (node.key && node.type === 'number') out.push(node)
    Object.values(node).forEach((v) => typeof v === 'object' && collect(v, out))
  }
  return out
}
const fields = collect(Object.values(schemas))

describe('kpi target schema fields', () => {
  it.each(Object.entries(TARGETS))('%s has min 1 and its default', (key, def) => {
    const f = fields.find((x) => x.key === key)
    expect(f).toBeTruthy()
    expect(f.min).toBe(1)
    expect(f.default).toBe(def)
  })
  it('keeps max 100 on fill rate', () => {
    expect(fields.find((x) => x.key === 'fill_rate_target').max).toBe(100)
  })
})
