/**
 * KPI target fields (BE lane L, M2): a stored 0 means "not set", so every target
 * field has min 1 (clearing sends empty); defaults and the fill-rate max stay.
 */
import { describe, it, expect, vi } from 'vitest'
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
interface Field { key: string; type: string; min?: number; default?: unknown; max?: number }
const collect = (node: unknown, out: Field[] = []): Field[] => {
  if (Array.isArray(node)) node.forEach((n) => collect(n, out))
  else if (node && typeof node === 'object') {
    const rec = node as Record<string, unknown>
    if (rec.key && rec.type === 'number') out.push(rec as unknown as Field)
    Object.values(rec).forEach((v) => typeof v === 'object' && collect(v, out))
  }
  return out
}
const fields = collect(Object.values(schemas))

describe('kpi target schema fields', () => {
  it.each(Object.entries(TARGETS))('%s has min 1 and its default', (key, def) => {
    const f = fields.find((x) => x.key === key)
    expect(f).toBeTruthy()
    expect(f?.min).toBe(1)
    expect(f?.default).toBe(def)
  })
  it('keeps max 100 on fill rate', () => {
    expect(fields.find((x) => x.key === 'fill_rate_target')?.max).toBe(100)
  })
})

// CONTRACT-FOLLOW-1 (6): clearing a target posts '' (never "null" or 0), which removes the row server-side.
const postMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: {} })))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { ...(actual.default as object), post: postMock } }
})
describe('kpi target removal wire', () => {
  it('POST /settings carries an empty string for a cleared target', async () => {
    const { saveSettingsKeys } = await import('@/lib/settings/useAllSettings')
    await saveSettingsKeys({ new_candidates_target: null })
    expect(postMock).toHaveBeenCalledWith('/settings', { new_candidates_target: '' })
  })
})
