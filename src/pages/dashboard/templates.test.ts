/**
 * Guard test (§13): every KPI id in KPI_ROWS must exist in buildDashboardKpis's
 * output. A stale id (e.g. the removed WhatsApp-personal `failedWa`/`waQueue`
 * ids) silently drops a KPI card via `.filter(Boolean)` in useDashboardViewModel
 * — this test turns that silent drop into a failing test instead.
 */
import { describe, it, expect } from 'vitest'
import { buildDashboardKpis } from './dashboardKpis'
import { KPI_ROWS, DASHBOARD_TEMPLATES, BLOCK_LABEL_KEY, switcherTypes, resolveDashboardType } from './templates'

describe('dashboard KPI row guard', () => {
  // Minimal stub args — only the shape matters, not the values, for id resolution.
  const kpiById = buildDashboardKpis({
    t: (k: string) => k,
    att: {},
    num: () => '',
    eur: () => '',
    opp: null,
    valueInHours: false,
    candidateTotalLabel: '',
    matchesTotal: null,
    vacanciesTotal: null,
    incompleteRuns: 0,
    conversationsCount: 0,
  })
  const knownIds = new Set(Object.keys(kpiById))

  // Every role's row must resolve to a real KPI — no id gets silently dropped.
  for (const [role, ids] of Object.entries(KPI_ROWS)) {
    it(`${role} KPI row only references ids that exist in buildDashboardKpis`, () => {
      const unknown = ids.filter(id => !knownIds.has(id))
      expect(unknown, `${role} references unknown KPI ids: ${unknown.join(', ')}`).toEqual([])
    })
  }

  // 'recruitment_manager' is registered in every role table (DASHBOARD-KIEZER-1).
  it('recruitment_manager is registered in KPI_ROWS and DASHBOARD_TEMPLATES', () => {
    expect(KPI_ROWS.recruitment_manager.length).toBeGreaterThan(0)
    expect(DASHBOARD_TEMPLATES.recruitment_manager).toContain('chart.recruiter')
  })

  // Regression guard: a block id present in some template but absent from
  // BLOCK_LABEL_KEY renders its raw id as the label in Settings → Dashboards
  // (the exact bug openVacancies hit for KPI_LABEL_KEY before, and 'chart.recruiter'
  // — added with recruitment_manager, DASHBOARD-KIEZER-1 — hit again for blocks).
  it('every block id referenced by any template has a BLOCK_LABEL_KEY entry', () => {
    const allBlockIds = new Set(Object.values(DASHBOARD_TEMPLATES).flat().filter(id => id !== '*'))
    const missing = [...allBlockIds].filter(id => !BLOCK_LABEL_KEY[id])
    expect(missing, `template block ids with no translated label: ${missing.join(', ')}`).toEqual([])
  })
})

describe('resolveDashboardType (richest-wins precedence)', () => {
  // AuthContext.dashboardType() delegates here (chain audit, DASHBOARD-KIEZER-1
  // follow-up) — /auth/me never sorts roles by precedence, so this must not
  // depend on array order.
  it('picks recruitment_manager over recruitment regardless of role order', () => {
    expect(resolveDashboardType(['recruitment', 'recruitment_manager'])).toBe('recruitment_manager')
    expect(resolveDashboardType(['recruitment_manager', 'recruitment'])).toBe('recruitment_manager')
  })

  it('management/admin still outrank every other dashboard type', () => {
    expect(resolveDashboardType(['recruitment_manager', 'management'])).toBe('management')
    expect(resolveDashboardType(['management', 'admin'])).toBe('admin')
  })

  it('falls back to readonly when no known type is present', () => {
    expect(resolveDashboardType([])).toBe('readonly')
    expect(resolveDashboardType(['some_unknown_type'])).toBe('readonly')
  })
})

describe('switcherTypes (DASHBOARD-KIEZER-1)', () => {
  it('drops admin/sales/readonly from the manual chooser list', () => {
    const list = switcherTypes(true)
    expect(list).not.toContain('admin')
    expect(list).not.toContain('sales')
    expect(list).not.toContain('readonly')
  })

  it('includes planning only when the tenant has the module', () => {
    expect(switcherTypes(true)).toContain('planning')
    expect(switcherTypes(false)).not.toContain('planning')
  })

  it('keeps recruitment_manager, recruitment and both sales-manager roles selectable', () => {
    const list = switcherTypes(false)
    expect(list).toEqual(expect.arrayContaining(['management', 'recruitment', 'recruitment_manager', 'backoffice', 'accountmanager', 'sales_manager']))
  })
})
