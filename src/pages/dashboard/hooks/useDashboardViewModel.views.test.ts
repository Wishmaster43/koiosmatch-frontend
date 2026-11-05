/** useDashboardViewModel · view-model scope, ordering and mirrored roles (split from useDashboardViewModel.test.ts; shared args in useDashboardViewModel.testKit.ts). */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDashboardViewModel } from './useDashboardViewModel'
import { baseArgs } from './useDashboardViewModel.testKit'

// DASHBOARD-OPRUIMING-1 (Danny 23-08, verbatim: "recruiter management dashboard
// moet nu zelfde zijn als management omdat alles ruk is, maar nu heb ik een leeg
// gat — dus maak hetzelfde"): recruitment_manager mirrors management verbatim —
// INCLUDING management's default exclusions since Danny 27-08 ("WhatsApp Web
// queue voor nu weg; Leads in pipeline ipv Recent runs"): waWebQueue and
// list.runs are hidden on both roles alike, leads-in-pipeline shows instead.
describe('useDashboardViewModel · recruitment_manager mirrors management', () => {
  it('shows the wildcard blocks minus the shared management exclusions', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({ activeType: 'recruitment_manager' as const })))
    for (const id of ['chart.status', 'chart.recruiter', 'chart.funnel', 'chart.funnelConversion', 'chart.weekly', 'list.candidates', 'list.applications', 'list.conversations', 'list.leads']) {
      expect(result.current.vis(id), `${id} should be visible for recruitment_manager`).toBe(true)
    }
    // The two exclusions Danny named (27-08) ride the mirror on BOTH roles.
    expect(result.current.vis('list.runs'), 'list.runs is excluded via the management mirror').toBe(false)
    expect(result.current.vis('block.waWebQueue'), 'waWebQueue is excluded via the management mirror').toBe(false)
  })

  it('renders the same KPI row as management, tenant-wide data included (chart.recruiter/by_owner)', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'recruitment_manager' as const,
      stats: { by_owner: [{ id: 'u1', name: 'Anna', count: 4 }, { id: 'u2', name: 'Bram', count: 6 }] },
    })))
    // The per-recruiter breakdown chart's data — genuinely team-wide (every
    // recruiter's count), not filtered to one owner.
    expect(result.current.recruiterData).toEqual([
      { name: 'Anna', value: 4, filterValue: 'u1' },
      { name: 'Bram', value: 6, filterValue: 'u2' },
    ])
    // Danny 24-08: the manager carries his OWN oversight nine now — only the
    // BLOCK set still mirrors management (asserted above via vis()).
    expect(result.current.kpis).toHaveLength(9)
  })
})

// RESILIENCE (measured map step 7): a tenant's saved dashboard_hidden config may
// still name a removed id (closingSoon/staleStatusVac/block.touchpoints/block.
// attention/block.staleLeads) from before DASHBOARD-OPRUIMING-1 — the hook must
// not crash, and must simply carry on rendering everything else.
describe('useDashboardViewModel · tolerates a saved hidden-config referencing removed ids', () => {
  it('does not throw and renders the KPI row normally when hiddenKpis names a removed id', () => {
    expect(() => renderHook(() => useDashboardViewModel(baseArgs({
      hiddenKpis: ['closingSoon', 'staleStatusVac'],
    })))).not.toThrow()
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({ hiddenKpis: ['closingSoon', 'staleStatusVac'] })))
    expect(result.current.kpis.length).toBeGreaterThan(0)
  })

  it('does not throw and vis() stays a plain boolean when hiddenBlocks names a removed id', () => {
    expect(() => renderHook(() => useDashboardViewModel(baseArgs({
      hiddenBlocks: ['block.touchpoints', 'block.attention', 'block.staleLeads'],
    })))).not.toThrow()
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({ hiddenBlocks: ['block.touchpoints'] })))
    expect(result.current.vis('chart.status')).toBe(true)
  })
})

// DASH-VOLGORDE-1 (Settings → Dashboards → Volgorde) — the KPI tile ORDER a
// tenant saved (dashboard_kpi_order, per role) must survive an opslaan→herladen
// cycle: the view model reorders the visible KPI row to match, an unknown/
// removed id in the stored order is dropped (never a blank tile, §0), and a
// role with no stored order at all keeps today's default order unchanged.
describe('useDashboardViewModel · DASH-VOLGORDE-1 per-role KPI tile order', () => {
  it('reorders the visible KPI row to match the stored kpiOrder for the active role', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'recruitment' as const,
      kpiOrder: {
        recruitment: ['never', 'tasks', 'candidatesNew', 'tasksOverdue', 'intakes', 'tooLongInStage', 'missingApptApps', 'redeployDue', 'placements'],
      },
    })))
    expect(result.current.kpis.map(k => k.id)).toEqual([
      'never', 'tasks', 'candidatesNew', 'tasksOverdue', 'intakes', 'tooLongInStage', 'missingApptApps', 'redeployDue', 'placements',
    ])
  })

  it('keeps the default KPI_ROWS order when the role has no stored order', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({ activeType: 'recruitment' as const })))
    expect(result.current.kpis.map(k => k.id)).toEqual([
      'tasks', 'tasksOverdue', 'candidatesNew', 'never', 'intakes', 'tooLongInStage', 'missingApptApps', 'redeployDue', 'placements',
    ])
  })

  it('drops an unknown/removed id from a stored order instead of rendering a blank tile', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'recruitment' as const,
      kpiOrder: { recruitment: ['never', 'removedLegacyId', 'tasks'] },
    })))
    const ids = result.current.kpis.map(k => k.id)
    expect(ids).not.toContain('removedLegacyId')
    expect(ids[0]).toBe('never')
    expect(ids).toHaveLength(9)
  })

  it('another role\'s stored order never leaks into this role\'s tile order', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'recruitment' as const,
      kpiOrder: { management: ['activeConv', 'candidates'] },
    })))
    expect(result.current.kpis.map(k => k.id)).toEqual([
      'tasks', 'tasksOverdue', 'candidatesNew', 'never', 'intakes', 'tooLongInStage', 'missingApptApps', 'redeployDue', 'placements',
    ])
  })
})

// K-173 fase 1/2/6 — scope, drills-driven KPI clicks, and the two new feed rows.
describe('useDashboardViewModel · K-173 scope + drills + recruiter_load/opp_aging', () => {
  it('passes dash.scope through verbatim, and null when absent (older server)', () => {
    const withScope = renderHook(() => useDashboardViewModel(baseArgs({
      dash: { scope: { role: 'recruitment', owner_dimension: 'own', unassigned_count: 3, includes_unassigned: true } },
    }))).result
    expect(withScope.current.scope).toEqual({ role: 'recruitment', owner_dimension: 'own', unassigned_count: 3, includes_unassigned: true })
    const noScope = renderHook(() => useDashboardViewModel(baseArgs({ dash: {} }))).result
    expect(noScope.current.scope).toBeNull()
  })

  it('a KPI tile navigates via its drill descriptor when dash.drills carries one', () => {
    const onNavigate = vi.fn()
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      // REAL server vocabulary (DashboardService::drills) — the translator turns
      // it into the page's intent; raw params never pass through. 'never' (never
      // contacted) is on the default 'recruitment' row this suite uses.
      dash: { kpis: { never_contacted: 4 }, drills: { never_contacted: { entity: 'candidates', params: { never_contacted: 1, owner_id: 'u-1' } } } },
      onNavigate,
    })))
    result.current.kpis.find(k => k.id === 'never')?.onClick?.()
    expect(onNavigate).toHaveBeenCalledWith('candidates', { attention: 'neverContacted', owner: 'u-1' })
  })

  it('defaults recruiterLoadRows/oppAgingRows to [] when the feed is absent', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({ dash: {} })))
    expect(result.current.recruiterLoadRows).toEqual([])
    expect(result.current.oppAgingRows).toEqual([])
  })

  it('passes recruiter_load/opp_aging rows through unchanged, server order preserved', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'recruitment_manager' as const,
      dash: {
        recruiter_load: [{ user_id: 'u2', name: 'Bram', open_tasks: 5, intakes_planned: 1, too_long_in_stage: 2 }],
        opp_aging: [{ bucket: '0-7', count: 3 }, { bucket: '90+', count: 1 }],
      },
    })))
    expect(result.current.recruiterLoadRows).toEqual([{ user_id: 'u2', name: 'Bram', open_tasks: 5, intakes_planned: 1, too_long_in_stage: 2 }])
    expect(result.current.oppAgingRows).toEqual([{ bucket: '0-7', count: 3 }, { bucket: '90+', count: 1 }])
  })
})
