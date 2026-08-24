/**
 * Guard test (§13): every KPI id in KPI_ROWS must exist in buildDashboardKpis's
 * output. A stale id (e.g. the removed WhatsApp-personal `failedWa`/`waQueue`
 * ids) silently drops a KPI card via `.filter(Boolean)` in useDashboardViewModel
 * — this test turns that silent drop into a failing test instead.
 */
import { describe, it, expect } from 'vitest'
import { buildDashboardKpis } from './dashboardKpis'
import { KPI_ROWS, DASHBOARD_TEMPLATES, BLOCK_LABEL_KEY, KPI_LABEL_KEY, switcherTypes, resolveDashboardType, visibleBlock, kpiRow } from './templates'

describe('dashboard KPI row guard', () => {
  // Minimal stub args — only the shape matters, not the values, for id resolution.
  const kpiById = buildDashboardKpis({
    t: (k: string) => k,
    kpis: {},
    num: () => '',
    eur: () => '',
    opp: null,
    valueInHours: false,
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
    expect(DASHBOARD_TEMPLATES.recruitment_manager).toContain('*')
  })

  // DASHBOARD-OPRUIMING-1 (Danny 23-08, verbatim: "recruiter management dashboard
  // moet nu zelfde zijn als management omdat alles ruk is"): recruitment_manager
  // no longer carries its own trimmed KPI/block vocabulary — it mirrors management
  // exactly, on both maps.
  // Danny 24-08 ("9 KPI rows met relevante KPI's" per rol) supersedes the 23-08
  // verbatim KPI mirror: the manager keeps management's full BLOCK set but
  // carries its own recruitment-oversight nine.
  it('recruitment_manager mirrors management BLOCKS and carries its own nine KPIs', () => {
    expect(DASHBOARD_TEMPLATES.recruitment_manager).toEqual(DASHBOARD_TEMPLATES.management)
    expect(KPI_ROWS.recruitment_manager).toHaveLength(9)
    expect(KPI_ROWS.recruitment_manager).not.toEqual(KPI_ROWS.management)
  })

  // Danny 24-08, definitief: ELKE rol heeft exact negen relevante KPI's.
  it('every role carries exactly nine KPIs', () => {
    for (const [role, row] of Object.entries(KPI_ROWS)) {
      expect(row, `${role} must carry nine KPIs`).toHaveLength(9)
      expect(new Set(row).size, `${role} row must not repeat a KPI`).toBe(9)
    }
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

// DASHBOARD-OPRUIMING-1 (Danny 23-08): "Werk af" · "Stilstaande leads" · "Vandaag"
// and the vacancy closingSoon/staleStatusVac KPIs are removed ENTIRELY, not just from
// the per-role templates — admin/management use the '*' wildcard, so a leftover
// catalog entry (KPI_LABEL_KEY/BLOCK_LABEL_KEY) would still surface in Settings →
// Dashboards even after the per-role arrays were pruned.
describe('dashboard cleanup (DASHBOARD-OPRUIMING-1)', () => {
  it('recruitment and recruitment_manager KPI rows contain neither closingSoon nor staleStatusVac', () => {
    for (const role of ['recruitment', 'recruitment_manager'] as const) {
      expect(KPI_ROWS[role]).not.toContain('closingSoon')
      expect(KPI_ROWS[role]).not.toContain('staleStatusVac')
    }
  })

  it('no template references the removed block ids', () => {
    const allBlockIds = new Set(Object.values(DASHBOARD_TEMPLATES).flat())
    expect(allBlockIds.has('block.touchpoints')).toBe(false)
    expect(allBlockIds.has('block.attention')).toBe(false)
    expect(allBlockIds.has('block.staleLeads')).toBe(false)
  })

  it('the removed ids have no catalog entry left (the admin/management "*" wildcard case)', () => {
    expect(KPI_LABEL_KEY.closingSoon).toBeUndefined()
    expect(KPI_LABEL_KEY.staleStatusVac).toBeUndefined()
    expect(BLOCK_LABEL_KEY['block.touchpoints']).toBeUndefined()
    expect(BLOCK_LABEL_KEY['block.attention']).toBeUndefined()
    expect(BLOCK_LABEL_KEY['block.staleLeads']).toBeUndefined()
  })

  // RESILIENCE (step 7): a tenant's saved dashboard_hidden config, or a stale
  // client cache, may still name a removed id — visibleBlock/kpiRow must stay
  // tolerant (never throw). For a non-wildcard role the removed id is simply
  // not visible; the '*' wildcard case (admin/management) is covered where the
  // renderer actually lives — DashboardFeedGrid.test.tsx — since visibleBlock's
  // '*' match is by design (any id), it is the JSX call site that had to go.
  it('visibleBlock/kpiRow never throw on a removed id, and a non-wildcard role hides it', () => {
    expect(() => visibleBlock('accountmanager', 'block.staleLeads')).not.toThrow()
    expect(visibleBlock('accountmanager', 'block.staleLeads')).toBe(false)
    expect(() => kpiRow('recruitment')).not.toThrow()
    expect(kpiRow('recruitment')).not.toContain('closingSoon')
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
