/**
 * buildKpiSpecs — both report idioms come out exactly as the pages built them:
 * camel-keyed cards with the click always wired (applications/whatsapp) and
 * server-keyed cards with an active flag and a value-gated click (matches …).
 */
import { describe, it, expect, vi } from 'vitest'
import type { TFunction } from 'i18next'
import { buildKpiSpecs, serverKpiSpecs, camelKpiSpecs, unitAwareServerKpiSpecs, thresholdCaption, unitMapFor } from './kpiSpecs'
import type { DrillSpec } from '../ReportDrillDrawer'

const t = ((key: string) => `L:${key}`) as unknown as TFunction
const labelKeys = { total: 'x.kpi.total', avg_days: 'x.kpi.avgDays', open_now: 'x.kpi.openNow' }
const colors = { total: 'var(--color-chart-1)', open_now: 'var(--color-chart-2)' }

describe('buildKpiSpecs', () => {
  it('camel idiom: keys by the label tail, keeps a number a number, dashes a NULL, colours only non-zero', () => {
    const openKpiDrill = vi.fn(() => () => {})
    const out = buildKpiSpecs({ kpis: new Map([['total', 12], ['avg_days', null], ['open_now', 0]]), labelKeys, colors, t, openKpiDrill })
    expect(Object.keys(out)).toEqual(['total', 'avgDays', 'openNow'])
    expect(out.total).toMatchObject({ key: 'total', label: 'L:x.kpi.total', value: 12, color: 'var(--color-chart-1)' })
    expect(out.avgDays.value).toBe('—')
    expect(out.avgDays.color).toBeUndefined()
    expect(out.openNow.color).toBeUndefined()
    expect(out.total).not.toHaveProperty('active')
    // The click is wired for every card, value included, exactly as the pages passed it.
    expect(openKpiDrill).toHaveBeenCalledWith('avg_days', 'L:x.kpi.avgDays', '—')
    expect(typeof out.total.onClick).toBe('function')
  })

  it('server idiom: keys by server key, marks the open drill active and gates the click on a value', () => {
    const openKpiDrill = vi.fn(() => () => {})
    const out = buildKpiSpecs({
      kpis: new Map([['total', 5], ['avg_days', undefined]]), labelKeys, colors, t, openKpiDrill,
      keyBy: 'server', activeKey: 'total', clickOnlyWhenHas: true,
      valueFor: (key, raw, has) => (!has ? '—' : key === 'avg_days' ? `${raw} d` : (raw as number)),
      subFor: key => (key === 'total' ? 'compare' : undefined),
    })
    expect(Object.keys(out)).toEqual(['total', 'avg_days', 'open_now'])
    expect(out.total).toMatchObject({ key: 'total', active: true, sub: 'compare', value: 5 })
    expect(out.avg_days).toMatchObject({ active: false, value: '—' })
    expect(out.avg_days.onClick).toBeUndefined()
    expect(openKpiDrill).toHaveBeenCalledTimes(1)
    expect(openKpiDrill).toHaveBeenCalledWith('total', 'L:x.kpi.total', 5)
  })

  it('omits the click when the report has no drill for that key', () => {
    const out = buildKpiSpecs({ kpis: new Map([['total', 1]]), labelKeys: { total: 'x.total' }, colors: {}, t, openKpiDrill: () => undefined })
    expect(out.total).not.toHaveProperty('onClick')
  })
})

describe('serverKpiSpecs', () => {
  it('builds kpiByServerKey from data.kpis and derives activeKey from drill.rowsParams.kpi', () => {
    const openKpiDrill = vi.fn(() => () => {})
    const out = serverKpiSpecs({
      data: { kpis: [{ key: 'total', count: 5 }, { key: 'avg_days', count: null }] },
      drill: { title: 't', value: 1, rowsParams: { kpi: 'total' } } as DrillSpec,
      labelKeys, colors, t, openKpiDrill,
    })
    expect(out.total).toMatchObject({ key: 'total', active: true, value: 5 })
    // clickOnlyWhenHas: a NULL server value never wires a click, and never marks active.
    expect(out.avg_days).toMatchObject({ active: false, value: '—' })
    expect(out.avg_days.onClick).toBeUndefined()
  })

  it('marks nothing active when no drill is open', () => {
    const openKpiDrill = vi.fn(() => () => {})
    const out = serverKpiSpecs({ data: { kpis: [{ key: 'total', count: 1 }] }, drill: null, labelKeys, colors, t, openKpiDrill })
    expect(out.total.active).toBe(false)
  })

  it('forwards valueFor/subFor to buildKpiSpecs untouched', () => {
    const openKpiDrill = vi.fn(() => () => {})
    const out = serverKpiSpecs({
      data: { kpis: [{ key: 'total', count: 5 }] }, drill: null, labelKeys, colors, t, openKpiDrill,
      valueFor: () => 'custom', subFor: () => 'sub',
    })
    expect(out.total.value).toBe('custom')
    expect(out.total.sub).toBe('sub')
  })
})

describe('camelKpiSpecs', () => {
  it('builds the camel-keyed record straight from data.kpis, same shape as calling buildKpiSpecs by hand', () => {
    const openKpiDrill = vi.fn(() => () => {})
    const out = camelKpiSpecs({
      data: { kpis: [{ key: 'total', count: 12 }, { key: 'avg_days', count: null }] },
      labelKeys, colors, t, openKpiDrill,
    })
    expect(Object.keys(out)).toEqual(['total', 'avgDays', 'openNow'])
    expect(out.total).toMatchObject({ key: 'total', value: 12, color: 'var(--color-chart-1)' })
    expect(out.total).not.toHaveProperty('active')
  })
})

describe('unitAwareServerKpiSpecs', () => {
  it('renders through renderKpiValue using the server-sent unit', () => {
    const openKpiDrill = vi.fn(() => () => {})
    const out = unitAwareServerKpiSpecs({
      data: { kpis: [{ key: 'total', count: 5, unit: 'days' } as unknown as { key: string; count: number | null }] },
      drill: null, labelKeys, colors, t, openKpiDrill, unitFallback: {},
    })
    // renderKpiValue formats a 'days'-unit value as "N days" rather than a bare number.
    expect(out.total.value).not.toBe(5)
    expect(String(out.total.value)).toContain('5')
  })

  it('falls back to the per-page unit map when the envelope carries no per-kpi unit', () => {
    const openKpiDrill = vi.fn(() => () => {})
    const out = unitAwareServerKpiSpecs({
      data: { kpis: [{ key: 'total', count: 5 }] }, drill: null, labelKeys, colors, t, openKpiDrill,
      unitFallback: { total: 'days' },
    })
    expect(String(out.total.value)).toContain('5')
  })

  it('a NULL server value stays the house dash and wires no click (server idiom still applies)', () => {
    const openKpiDrill = vi.fn(() => () => {})
    const out = unitAwareServerKpiSpecs({
      data: { kpis: [{ key: 'total', count: null }] }, drill: null, labelKeys, colors, t, openKpiDrill, unitFallback: {},
    })
    expect(out.total.value).toBe('—')
    expect(out.total.onClick).toBeUndefined()
  })
})

describe('thresholdCaption', () => {
  it('renders the "N days" caption when the tenant threshold is set', () => {
    expect(thresholdCaption(t, 'stale', { stale: 14 })).toBe('L:thresholdDays')
  })

  it('returns undefined when the key has no configured threshold (null or missing)', () => {
    expect(thresholdCaption(t, 'stale', { stale: null })).toBeUndefined()
    expect(thresholdCaption(t, 'missing', {})).toBeUndefined()
  })
})

describe('unitMapFor', () => {
  it('reads the server unit per key, falling back to the per-page map only when unit is absent', () => {
    const map = unitMapFor([{ key: 'a', unit: 'euro' }, { key: 'b' }], { b: 'days', a: 'ratio' })
    expect(map.get('a')).toBe('euro') // server unit wins even when a fallback exists.
    expect(map.get('b')).toBe('days')
  })

  it('returns an empty map for an undefined kpis array', () => {
    expect(unitMapFor(undefined, {})).toEqual(new Map())
  })
})
