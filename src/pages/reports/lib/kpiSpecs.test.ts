/**
 * buildKpiSpecs — both report idioms come out exactly as the pages built them:
 * camel-keyed cards with the click always wired (applications/whatsapp) and
 * server-keyed cards with an active flag and a value-gated click (matches …).
 */
import { describe, it, expect, vi } from 'vitest'
import type { TFunction } from 'i18next'
import { buildKpiSpecs } from './kpiSpecs'

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
