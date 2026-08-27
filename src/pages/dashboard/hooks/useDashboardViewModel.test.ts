/**
 * useDashboardViewModel — K-168 tile semantics: a rights-gated key is ALWAYS
 * present (null = viewer lacks the right → honest '—'), so the D6 tiles render
 * a dash rather than hiding; only a MODULE-gated key (incomplete_runs/
 * open_shifts/occupancy) is genuinely absent without the module, and that
 * absence hides its tile (no zero-tile invention, §3).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import i18n from '@/i18n'
import { useDashboardViewModel } from './useDashboardViewModel'

// Minimal args — only the fields the recruitment KPI row + attention merge read.
const baseArgs = (overrides: Record<string, unknown> = {}) => ({
  t: (k: string) => k,
  formatNumber: (v: number) => String(v),
  stats: null,
  opp: null,
  dash: null,
  dashCharts: null,
  statusMeta: () => ({ value: '', label: '', color: '' }),
  funnelMeta: () => ({ value: '', label: '', color: '' }),
  funnelTypes: [],
  activeType: 'recruitment' as const,
  hiddenBlocks: [],
  hiddenKpis: [],
  hasPlanning: false,
  valueInHours: false,
  ...overrides,
})

describe('useDashboardViewModel · K-168 rights-gated tiles always render (null → dash)', () => {
  it('renders the D6 tiles with an honest dash when their key is null (viewer lacks the right)', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      dash: { kpis: { app_too_long_in_stage: null, app_missing_appointment: null },
        kpi_row: ['app_too_long_in_stage', 'app_missing_appointment'] },
    })))
    const byId = Object.fromEntries(result.current.kpis.map(k => [k.id, k.value]))
    expect(byId.tooLongInStage).toBe('—')
    expect(byId.missingApptApps).toBe('—')
  })

  it('renders each D6 tile with its real count when the server sends one', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      dash: { kpis: { app_too_long_in_stage: 3, app_missing_appointment: 2 },
        kpi_row: ['app_too_long_in_stage', 'app_missing_appointment'] },
    })))
    const byId = Object.fromEntries(result.current.kpis.map(k => [k.id, k.value]))
    expect(byId.tooLongInStage).toBe('3')
    expect(byId.missingApptApps).toBe('2')
  })

  it('renders missingDocs with a dash on null and the real count when sent', () => {
    const nullRes = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'backoffice' as const,
      dash: { kpis: { missing_documents: null } },
    }))).result
    expect(nullRes.current.kpis.find(k => k.id === 'missingDocs')?.value).toBe('—')
    const numRes = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'backoffice' as const,
      dash: { kpis: { missing_documents: 4 } },
    }))).result
    expect(numRes.current.kpis.find(k => k.id === 'missingDocs')?.value).toBe('4')
  })
})

// MODULE-gated keys are the only ones K-168 actually omits: no workflows module →
// no incomplete_runs key → no tile (never a permanent '—' for a module the
// tenant does not have).
describe('useDashboardViewModel · module-gated tiles hide on key absence', () => {
  it('omits incompleteRuns when incomplete_runs is absent from dash.kpis', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'backoffice' as const,
      dash: { kpis: {} },
    })))
    expect(result.current.kpis.map(k => k.id)).not.toContain('incompleteRuns')
  })

  it('renders incompleteRuns once the key is present — including null (right-gated inside the module)', () => {
    const present = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'backoffice' as const,
      dash: { kpis: { incomplete_runs: 2 } },
    }))).result
    expect(present.current.kpis.find(k => k.id === 'incompleteRuns')?.value).toBe('2')
    const nullPresent = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'backoffice' as const,
      dash: { kpis: { incomplete_runs: null } },
    }))).result
    expect(nullPresent.current.kpis.find(k => k.id === 'incompleteRuns')?.value).toBe('—')
  })

  it('omits occupancy without its key and renders it once present (planning module on)', () => {
    const absent = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'planning' as const, hasPlanning: true,
      dash: { kpis: {} },
    }))).result
    expect(absent.current.kpis.map(k => k.id)).not.toContain('occupancy')
    const present = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'planning' as const, hasPlanning: true,
      dash: { kpis: { occupancy: 80 } },
    }))).result
    const byId = Object.fromEntries(present.current.kpis.map(k => [k.id, k.value]))
    expect(byId.occupancy).toBe('80%')
  })
})

// K1 (DASH-KPI-SERVER-FE-1, BE K-168) — KPI values come ONLY from dash.kpis now.
describe('useDashboardViewModel · K1 server-computed KPI values', () => {
  it('a KPI value comes from dash.kpis, never from opp/meta-total/attention (new wins)', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'admin' as const,
      // Deliberately conflicting values on the OLD locations vs the NEW dash.kpis
      // location — the new server block must win. admin's v3 row carries
      // matches_active/placements/open_vacancies, not opps_total.
      opp: { total: 999, pipeline_value: 999999 },
      stats: { attention: { placements: 999 } },
      dash: { kpis: { matches_active: 5, pipeline_value: 1234, placements: 7, open_vacancies: 3 } },
    })))
    const byId = Object.fromEntries(result.current.kpis.map(k => [k.id, k.value]))
    expect(byId.matchesActive).toBe('5')
    expect(byId.placements).toBe('7')
    expect(byId.openVacancies).toBe('3')
  })

  it('null in dash.kpis renders the dash placeholder, not a fallback', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'backoffice' as const,
      dash: { kpis: { placements: null } },
    })))
    expect(result.current.kpis.find(k => k.id === 'placements')?.value).toBe('—')
  })

  it('the candidates tile reads kpis.candidates_total — never a local list-total probe', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      // 'readonly' carries 'candidates' on its v3 row; the default 'recruitment'
      // row no longer does (plan: candidates_total left the recruiter's row).
      activeType: 'readonly' as const,
      dash: { kpis: { candidates_total: 42 } },
    })))
    expect(result.current.kpis.find(k => k.id === 'candidates')?.value).toBe('42')
  })

  it('a real zero renders "0" (and 0% for rate tiles) — zero is data, only null is a dash', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'sales' as const,
      dash: { kpis: { placements: 0, fill_rate: 0 } },
    })))
    const byId = Object.fromEntries(result.current.kpis.map(k => [k.id, k.value]))
    expect(byId.placements).toBe('0')
    expect(byId.fillRate).toBe('0%')
  })

  it('a response without dash.kpis at all (old server) never crashes and shows placeholders', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'admin' as const,
      dash: {},
    })))
    expect(() => result.current.kpis).not.toThrow()
    const byId = Object.fromEntries(result.current.kpis.map(k => [k.id, k.value]))
    expect(byId.matchesActive).toBe('—')
    expect(byId.placements).toBe('—')
  })
})

describe('useDashboardViewModel · KD11 (DASHP36) widget-feed rows', () => {
  it('maps expiring_matches/stale_vacancies/koios_suggestions to click-through rows', () => {
    const onNavigate = vi.fn()
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'sales_manager' as const,
      dash: {
        expiring_matches: [{ id: 1, candidate_name: 'Jan Jansen', customer_name: 'Acme', end_date: '2026-09-01' }],
        stale_vacancies: [{ id: 3, title: 'Verpleegkundige', published_at: '2026-06-01' }],
        koios_suggestions: [{ vacancy_id: 4, vacancy_title: 'Chauffeur', suggestions_count: 7 }],
      },
      onNavigate,
    })))
    expect(result.current.expiringMatchesRows).toHaveLength(1)
    expect(result.current.expiringMatchesRows[0].primary).toBe('Jan Jansen')
    result.current.expiringMatchesRows[0].onClick?.()
    expect(onNavigate).toHaveBeenCalledWith('matches', { open: 1 })

    result.current.staleVacanciesRows[0].onClick?.()
    expect(onNavigate).toHaveBeenCalledWith('vacancies', { open: 3 })

    result.current.koiosSuggestionsRows[0].onClick?.()
    expect(onNavigate).toHaveBeenCalledWith('vacancies', { open: 4 })
  })

  // customersByOwnerRows moved to blocks/sales/CustomersByOwnerDonut.tsx — the
  // hook no longer returns it (mirrors the staleLeadsRows resilience pin below).
  it('no longer returns customersByOwnerRows', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'sales_manager' as const,
      dash: { customers_by_owner: [{ owner_id: 5, name: 'Team A', count: 12 }] },
    })))
    expect(result.current).not.toHaveProperty('customersByOwnerRows')
  })

  // Resilience pin (measured map step 7): staleLeadsRows was removed from the
  // hook's return entirely — a stale caller/test destructuring it must not see
  // a crash, only `undefined` (never a raw/rendered id).
  it('no longer returns staleLeadsRows', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      dash: { stale_leads: [{ id: 2, name: 'Piet Pos', phase_changed_at: '2026-07-01' }] },
    })))
    expect((result.current as Record<string, unknown>).staleLeadsRows).toBeUndefined()
  })

  it('falls back to the customer name when candidate_name is PII-redacted (null, no candidates.view)', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      dash: { expiring_matches: [{ id: 1, candidate_name: null, customer_name: 'Acme', end_date: '2026-09-01' }] },
    })))
    expect(result.current.expiringMatchesRows[0].primary).toBe('Acme')
    expect(result.current.expiringMatchesRows[0].secondary).toBeUndefined()
  })
})

// LOOKUP-I18N-1 regression (round 2): the 'Recent runs' feed used to render the
// seeded workflow name verbatim (r.name || '—'), so an English tenant still saw
// the Dutch seed text ('Leads-telling vacatures'). Every ai_runs row now routes
// through seedLabel('workflowNames', …) — a still-seeded name translates, and a
// tenant-renamed workflow (no catalogue match) passes through untouched.
describe('useDashboardViewModel · LOOKUP-I18N-1 translates the seeded workflow run name', () => {
  it('translates a still-seeded ai_runs name to the active UI language', async () => {
    // Switch BEFORE mounting, unmount BEFORE switching back — resetting the
    // language on a still-mounted hook fires a state update outside act()
    // (mirrors CustomersTable.test.tsx's changeLanguage convention).
    await i18n.changeLanguage('en')
    const { result, unmount } = renderHook(() => useDashboardViewModel(baseArgs({
      dash: { ai_runs: [{ name: 'Leads-telling vacatures', ran_at: null, ok: true, processed: 1, error: null }] },
    })))
    expect(result.current.runs[0].name).toBe('Vacancy lead count')
    unmount()
    await i18n.changeLanguage('nl')
  })

  it('leaves a tenant-renamed workflow name untouched (no catalogue match)', async () => {
    await i18n.changeLanguage('en')
    const { result, unmount } = renderHook(() => useDashboardViewModel(baseArgs({
      dash: { ai_runs: [{ name: 'Onze eigen automatisering', ran_at: null, ok: true, processed: 1, error: null }] },
    })))
    expect(result.current.runs[0].name).toBe('Onze eigen automatisering')
    unmount()
    await i18n.changeLanguage('nl')
  })
})

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
