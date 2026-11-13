/** useDashboardViewModel · KPI row source, switched views and module gating (split from useDashboardViewModel.test.ts; shared args in useDashboardViewModel.testKit.ts). */
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDashboardViewModel } from './useDashboardViewModel'
import { baseArgs } from './useDashboardViewModel.testKit'

// K-173 kpi_row (714eae01): the server's viewer-effective ordered row IS the
// live truth — blob hidden/order and the role template lose to it.
describe('useDashboardViewModel · kpi_row is the one live source', () => {
  it('renders exactly the kpi_row tiles, in server order, ignoring the blob', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'admin' as const,
      hiddenKpis: ['opps'],
      dash: { kpis: { opps_total: 5, placements: 7, candidates_total: 3 }, kpi_row: ['placements', 'opps_total', 'candidates_total'] },
    })))
    // opps renders DESPITE the blob hiding it (server row wins), in server order.
    expect(result.current.kpis.map(k => k.id)).toEqual(['placements', 'opps', 'candidates'])
  })

  it('module gates still apply on top of kpi_row — an absent module key never resurrects', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'backoffice' as const,
      dash: { kpis: {}, kpi_row: ['incomplete_runs', 'placements'] },
    })))
    expect(result.current.kpis.map(k => k.id)).toEqual(['placements'])
  })
})

// Danny (live, Management-wisselaar toonde drie 'default'-tegels): a server row
// for a DIFFERENT api-role than the viewed type falls back to the type's
// template — and the full server vocabulary renders (no silent tile loss).
describe('useDashboardViewModel · switched views + full vocabulary', () => {
  it('ignores kpi_row when its scope role maps to another api-role than the viewed type', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'recruitment' as const,
      dash: { kpis: { placements: 7 }, kpi_row: ['placements'], scope: { role: 'admin' } },
    })))
    // recruitment template row renders, not the one-tile admin/default row.
    expect(result.current.kpis.length).toBeGreaterThan(1)
  })

  it('renders every key of a full server row — including the newly mapped vocabulary', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'admin' as const,
      dash: { kpis: {}, kpi_row: ['candidates_total', 'candidates_new', 'no_followup', 'leads_pipeline', 'vacancies_active', 'intakes', 'matches', 'fill_rate', 'placements'], scope: { role: 'admin' } },
    })))
    expect(result.current.kpis.map(k => k.id)).toEqual([
      'candidates', 'candidatesNew', 'noFollowup', 'leadsPipeline', 'vacanciesActive', 'intakesDone', 'matchesTotal', 'fillRate', 'placements',
    ])
  })
})

// DASH-V3-UITROL-1 — the four shift keys + open_shifts_48h are ABSENT (not
// null) without the planning module (K-179 contract); their tiles must hide
// entirely rather than show a permanent '—'.
describe('useDashboardViewModel · v3 shift keys hide on module absence', () => {
  it('omits the four shift KPIs + openShifts48h when their keys are absent from dash.kpis', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'planning' as const, hasPlanning: true,
      dash: { kpis: {} },
    })))
    const ids = result.current.kpis.map(k => k.id)
    expect(ids).not.toContain('openShifts48h')
    expect(ids).not.toContain('shiftsUnconfirmed')
    expect(ids).not.toContain('shiftsNoshowToday')
    expect(ids).not.toContain('shiftsCancelledToday')
  })

  it('renders the four shift KPIs once their keys are present, including an honest null', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'planning' as const, hasPlanning: true,
      dash: { kpis: { open_shifts_48h: 3, shifts_unconfirmed: 1, shifts_noshow_today: null, shifts_cancelled_today: 0 } },
    })))
    const byId = Object.fromEntries(result.current.kpis.map(k => [k.id, k.value]))
    expect(byId.openShifts48h).toBe('3')
    expect(byId.shiftsUnconfirmed).toBe('1')
    expect(byId.shiftsNoshowToday).toBe('—')
    expect(byId.shiftsCancelledToday).toBe('0')
  })
})

// PLANNING_BLOCKS gate — vis() must hide every planning-feed block id (not just
// the legacy 'block.shifts') when the tenant lacks the planning module, and show
// them all once it has it.
describe('useDashboardViewModel · vis() gates on PLANNING_BLOCKS, not a single literal', () => {
  const planningIds = [
    'block.shifts', 'block.shiftCoverageHeatmap', 'block.openShiftsList',
    'block.occupancyByCustomer', 'block.shiftStatusToday', 'block.shiftsUnconfirmedList',
  ]

  it('hides every planning block id when hasPlanning is false', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'planning' as const, hasPlanning: false, dash: { kpis: {} },
    })))
    for (const id of planningIds) expect(result.current.vis(id)).toBe(false)
  })

  it('shows every planning block id when hasPlanning is true', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'planning' as const, hasPlanning: true, dash: { kpis: {} },
    })))
    for (const id of planningIds) expect(result.current.vis(id)).toBe(true)
  })
})

// ENT2-07 — `net` is a sibling series INSIDE charts.timeseries, not a top-level
// charts key; the trend row/series builder must read it from there.
describe('useDashboardViewModel · ENT2-07 net series reads from charts.timeseries.net', () => {
  it('includes the net series in trendData/trendSeries when timeseries.net is present', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      dash: { kpis: {} },
      dashCharts: {
        timeseries: {
          candidates_in: [{ name: 'wk 36', value: 3 }],
          net: [{ name: 'wk 36', value: 0 }, { name: 'wk 37', value: 1 }],
        },
      },
    })))
    expect(result.current.trendSeries.some(s => s.key === 'net')).toBe(true)
    const row = result.current.trendData.find(r => r.name === 'wk 37')
    expect(row?.net).toBe(1)
  })

  it('omits net from present series when timeseries carries no net key', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      dash: { kpis: {} },
      dashCharts: { timeseries: { candidates_in: [{ name: 'wk 36', value: 3 }] } },
    })))
    const row = result.current.trendData.find(r => r.name === 'wk 36')
    expect(row?.net).toBeUndefined()
  })
})

// Shared resolver regression: a visible KPI missing from the stored order is backfilled, never dropped.
describe('useDashboardViewModel · stored order backfill', () => {
  it('still renders a visible KPI that the stored order leaves out', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'admin' as const,
      dash: { kpis: { placements: 7, opps_total: 5, candidates_total: 3 } },
      kpiOrder: { admin: ['placements'] },
    })))
    const ids = result.current.kpis.map(k => k.id)
    expect(ids[0]).toBe('placements')
    expect(ids.length).toBeGreaterThan(1)
  })
})
