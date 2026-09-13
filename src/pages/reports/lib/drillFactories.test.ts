/**
 * makeOpenKpiDrill / makeOpenSegment — the shared drill-opener factories. Asserts
 * the emitted DrillSpec (endpoints/params), not just that the callback fired
 * (§13: a test that does not touch the seam proves nothing about the seam).
 */
import { describe, it, expect, vi } from 'vitest'
import { makeOpenKpiDrill, makeOpenSegment } from './drillFactories'

describe('makeOpenKpiDrill', () => {
  it('defaults entityPage to the report id and layers the kpi XOR param on baseParams', () => {
    const setDrill = vi.fn()
    const open = makeOpenKpiDrill({
      report: 'applications', rowsEndpoint: '/reports/applications/kpis/drill',
      baseParams: { period: 'month' }, windowSub: () => 'Sep 2026', setDrill,
    })
    // makeOpenKpiDrill returns the CLICK HANDLER (gated), so call it to fire setDrill.
    open('total', 'Total', 12)?.()
    expect(setDrill).toHaveBeenCalledWith({
      title: 'Total', value: 12, subtitle: 'Sep 2026', entityPage: 'applications',
      rowsEndpoint: '/reports/applications/kpis/drill', rowsParams: { period: 'month', kpi: 'total' },
    })
  })

  it('omits entityPage entirely when passed null (outreach: rows are not one entity page)', () => {
    const setDrill = vi.fn()
    const open = makeOpenKpiDrill({
      report: 'outreach', rowsEndpoint: '/reports/outreach/kpis/drill',
      baseParams: {}, windowSub: () => 'W', setDrill, entityPage: null,
    })
    open('reached', 'Reached', 3)?.()
    const spec = setDrill.mock.calls[0][0]
    expect(spec).not.toHaveProperty('entityPage')
    expect(spec.rowsEndpoint).toBe('/reports/outreach/kpis/drill')
  })

  it('an explicit subtitle wins over windowSub()', () => {
    const setDrill = vi.fn()
    const windowSub = vi.fn(() => 'fallback')
    const open = makeOpenKpiDrill({ report: 'tasks', rowsEndpoint: '/x', baseParams: {}, windowSub, setDrill })
    open('total', 'Total', 1, 'explicit')?.()
    expect(setDrill).toHaveBeenCalledWith(expect.objectContaining({ subtitle: 'explicit' }))
  })
})

describe('makeOpenSegment', () => {
  it('keeps rowsEndpoint and adviceEndpoint distinct — a swap at the call site would now be a compile error, not a silent mixup', () => {
    const setDrill = vi.fn()
    const open = makeOpenSegment({
      entityPage: 'vacancies', rowsEndpoint: '/reports/vacancies/drill', adviceEndpoint: '/reports/vacancies/advice',
      baseParams: { period: 'month' }, windowSub: () => 'Sep 2026', setDrill,
    })
    open({ label: 'Stale', count: 4 }, { stale: 1 })
    expect(setDrill).toHaveBeenCalledWith({
      title: 'Stale', value: 4, subtitle: 'Sep 2026', entityPage: 'vacancies',
      rowsEndpoint: '/reports/vacancies/drill', rowsParams: { period: 'month', stale: 1 },
      adviceEndpoint: '/reports/vacancies/advice', adviceParams: { period: 'month', stale: 1 },
    })
  })

  it('omits entityPage when not passed (outreach drill rows are not one entity page)', () => {
    const setDrill = vi.fn()
    const open = makeOpenSegment({
      rowsEndpoint: '/reports/outreach/drill', adviceEndpoint: '/reports/outreach/advice',
      baseParams: {}, windowSub: () => 'W', setDrill,
    })
    open({ label: 'Channel', count: 2 }, { channel: 'whatsapp' })
    expect(setDrill.mock.calls[0][0]).not.toHaveProperty('entityPage')
  })
})
