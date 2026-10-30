/**
 * dashboardKpis — D6 tile→intent mapping (the seam, per CLAUDE.md §13): the
 * tiles emit a SEMANTIC intent ({ attention: '<name>' }), the house
 * convention (onNavigate('candidates', { attention: 'stale6m' }), CandidatesPage:113)
 * — never a raw server filter param. The destination page's own consumption of
 * that intent is asserted separately (ApplicationsPage.test.tsx). closingSoon/
 * staleStatusVac (formerly D1(a)) are removed entirely (DASHBOARD-OPRUIMING-1).
 */
import { describe, it, expect, vi } from 'vitest'
import { buildDashboardKpis } from './dashboardKpis'
import type { Mock } from 'vitest'

// vitest 5 types a bare vi.fn() as Procedure | Constructable; give the navigate mock its real signature.
type NavMock = Mock<(page: string, intent?: Record<string, unknown>) => void>

// Minimal args builder — only the fields these tiles read. K1: KPI values come
// from the server `kpis` block now, not att/opp/meta-total fallbacks.
const baseArgs = (kpis: Record<string, number | null | undefined>, onNavigate: NavMock) => ({
  t: (k: string) => k,
  kpis,
  num: (v?: number | null) => (v == null ? '—' : String(v)),
  pct: (v: number) => `${v}%`,
  eur: (v?: unknown) => String(v),
  opp: null,
  candidateTotalLabel: '0',
  onNavigate,
})

describe('buildDashboardKpis · D6 attention tiles', () => {
  it('tooLongInStage navigates to /applications with the tooLongInStage intent', () => {
    const onNavigate: NavMock = vi.fn()
    const kpis = buildDashboardKpis(baseArgs({ app_too_long_in_stage: 3 }, onNavigate))
    kpis.tooLongInStage.onClick?.()
    expect(onNavigate).toHaveBeenCalledWith('applications', { attention: 'tooLongInStage' })
  })

  it('missingApptApps navigates to /applications with the missingAppointment intent', () => {
    const onNavigate: NavMock = vi.fn()
    const kpis = buildDashboardKpis(baseArgs({ app_missing_appointment: 2 }, onNavigate))
    kpis.missingApptApps.onClick?.()
    expect(onNavigate).toHaveBeenCalledWith('applications', { attention: 'missingAppointment' })
  })

  // DASHBOARD-OPRUIMING-1 (Danny 23-08): closingSoon/staleStatusVac (the vacancy
  // KPI tiles) are removed entirely — pin their absence, not their behaviour.
  it('no longer builds the removed closingSoon/staleStatusVac KPI tiles', () => {
    const onNavigate: NavMock = vi.fn()
    const kpis = buildDashboardKpis(baseArgs({ vac_closing_soon: 5, vac_stale_status: 1 }, onNavigate))
    expect(kpis.closingSoon).toBeUndefined()
    expect(kpis.staleStatusVac).toBeUndefined()
  })
})

// K1 (DASH-KPI-SERVER-FE-1, BE K-168) — every KPI value comes exclusively from
// the server `kpis` block now, never a client-side fallback.
describe('buildDashboardKpis · K1 server-computed values', () => {
  it('reads a KPI value from kpis, not from any other source', () => {
    const onNavigate: NavMock = vi.fn()
    const kpis = buildDashboardKpis(baseArgs({ open_vacancies: 7 }, onNavigate))
    expect(kpis.openVacancies.value).toBe('7')
  })

  it('null in kpis renders the dash placeholder', () => {
    const onNavigate: NavMock = vi.fn()
    const kpis = buildDashboardKpis(baseArgs({ placements: null }, onNavigate))
    expect(kpis.placements.value).toBe('—')
  })

  it('a response without kpis at all never crashes and shows placeholders', () => {
    const onNavigate: NavMock = vi.fn()
    const kpis = buildDashboardKpis(baseArgs({}, onNavigate))
    expect(kpis.openVacancies.value).toBe('—')
    expect(kpis.placements.value).toBe('—')
    expect(kpis.activeConv.value).toBe('—')
  })
})

// K-173 fase 2 — a tile with a drill descriptor navigates via entity+params
// (the server's exact list filters), not the tile's own hardcoded intent.
describe('buildDashboardKpis · K-173 drill descriptors (REAL server payloads)', () => {
  it('translates the server filter vocabulary into the page intent — params never pass raw', () => {
    const onNavigate: NavMock = vi.fn()
    // Exactly what DashboardService::drills emits for a recruiter's stale tile.
    const args = { ...baseArgs({ stale_6m: 4 }, onNavigate), drills: { stale_6m: { entity: 'candidates', params: { stale_6m: 1, owner_id: 'u-1', location_id: 'l-1' } } } }
    const kpis = buildDashboardKpis(args)
    kpis.stale.onClick?.()
    expect(onNavigate).toHaveBeenCalledWith('candidates', { attention: 'stale6m', owner: 'u-1', location: 'l-1' })
  })

  it('translates the tasks drill (open + assignee scope) into the tasks intent', () => {
    const onNavigate: NavMock = vi.fn()
    const args = { ...baseArgs({ tasks: 7 }, onNavigate), drills: { tasks: { entity: 'tasks', params: { open: 1, assignee_id: 'u-1' } } } }
    const kpis = buildDashboardKpis(args)
    kpis.tasks.onClick?.()
    expect(onNavigate).toHaveBeenCalledWith('tasks', { kpi: 'open', assignee: 'u-1' })
  })

  it('translates the missing_documents drill into the candidates missingDocs intent', () => {
    const onNavigate: NavMock = vi.fn()
    const args = { ...baseArgs({ missing_documents: 2 }, onNavigate), drills: { missing_documents: { entity: 'candidates', params: { missing_documents: 1 } } } }
    const kpis = buildDashboardKpis(args)
    kpis.missingDocs.onClick?.()
    expect(onNavigate).toHaveBeenCalledWith('candidates', { attention: 'missingDocs' })
  })

  it('translates the coupling_errors drill into the coupling-errors page; an untranslated entity still falls back', () => {
    const onNavigate: NavMock = vi.fn()
    const args = { ...baseArgs({ coupling_errors: 3, failed_workflows: 1 }, onNavigate), drills: {
      coupling_errors: { entity: 'external-id-mapping-failures', params: {} },
      failed_workflows: { entity: 'workflow-runs', params: { status: 'failed' } },
    } }
    const kpis = buildDashboardKpis(args)
    kpis.couplingErrors.onClick?.()
    expect(onNavigate).toHaveBeenLastCalledWith('coupling-errors', {})
    // workflow-runs still has no FE page — the tile keeps its legacy fallback intent.
    kpis.failedWf.onClick?.()
    expect(onNavigate).toHaveBeenLastCalledWith('workflows', {})
  })

  it('an explicit null descriptor renders the tile WITHOUT onClick (no dead cell, no fallback)', () => {
    const onNavigate: NavMock = vi.fn()
    const args = { ...baseArgs({ stale_6m: 4 }, onNavigate), drills: { stale_6m: null } }
    const kpis = buildDashboardKpis(args)
    expect(kpis.stale.onClick).toBeUndefined()
  })

  it('an absent drills key falls back to the tile own hardcoded intent (pre-K-173 server)', () => {
    const onNavigate: NavMock = vi.fn()
    const kpis = buildDashboardKpis(baseArgs({ stale_6m: 4 }, onNavigate))
    kpis.stale.onClick?.()
    expect(onNavigate).toHaveBeenCalledWith('candidates', { attention: 'stale6m' })
  })
})

// DASH-V3-UITROL-1 (K-179) — the 18 v3 tiles: percentage/day-count formatting
// and the honest null → '—' contract (customers_prospect is null pre-fresh).
describe('buildDashboardKpis · DASH-V3-UITROL-1 tiles', () => {
  it('formats opps_win_rate as a percentage, and "—" when null', () => {
    const onNavigate: NavMock = vi.fn()
    const withValue = buildDashboardKpis(baseArgs({ opps_win_rate: 42 }, onNavigate))
    expect(withValue.oppsWinRate.value).toBe('42%')
    const withNull = buildDashboardKpis(baseArgs({ opps_win_rate: null }, onNavigate))
    expect(withNull.oppsWinRate.value).toBe('—')
  })

  it('time_to_submit_avg renders as a plain day count (no interpolation on this builder)', () => {
    const onNavigate: NavMock = vi.fn()
    const kpis = buildDashboardKpis(baseArgs({ time_to_submit_avg: 5 }, onNavigate))
    expect(kpis.timeToSubmit.value).toBe('5')
  })

  it('customers_prospect renders "—" for a fresh tenant (null, no right/not-yet-computed)', () => {
    const onNavigate: NavMock = vi.fn()
    const kpis = buildDashboardKpis(baseArgs({ customers_prospect: null }, onNavigate))
    expect(kpis.customersProspect.value).toBe('—')
  })

  it('every v3 tile id exists and reads its own server key', () => {
    const onNavigate: NavMock = vi.fn()
    const kpis = buildDashboardKpis(baseArgs({
      matches_active: 1, applications_active: 2, vacancies_stale: 3, redeploy_due_14d: 4,
      time_to_submit_avg: 5, opps_new: 6, opps_stalled: 7, opps_win_rate: 8,
      customers_active: 9, customers_prospect: 10, customers_at_risk: 11,
      placements_incomplete: 12, documents_expiring_30d: 13, open_shifts_48h: 14,
      shifts_unconfirmed: 15, shifts_noshow_today: 16, shifts_cancelled_today: 17,
      candidates_available: 18,
    }, onNavigate))
    expect(kpis.matchesActive.value).toBe('1')
    expect(kpis.applicationsActive.value).toBe('2')
    expect(kpis.vacanciesStale.value).toBe('3')
    expect(kpis.redeployDue.value).toBe('4')
    expect(kpis.oppsNew.value).toBe('6')
    expect(kpis.oppsStalled.value).toBe('7')
    expect(kpis.customersActive.value).toBe('9')
    expect(kpis.customersAtRisk.value).toBe('11')
    expect(kpis.placementsIncomplete.value).toBe('12')
    expect(kpis.documentsExpiring.value).toBe('13')
    expect(kpis.openShifts48h.value).toBe('14')
    expect(kpis.shiftsUnconfirmed.value).toBe('15')
    expect(kpis.shiftsNoshowToday.value).toBe('16')
    expect(kpis.shiftsCancelledToday.value).toBe('17')
    expect(kpis.candidatesAvailable.value).toBe('18')
  })
})

// GETALLEN-1 regression: fillRate/occupancy must run their raw server number
// through the house `num` formatter, mirroring the oppsWinRate tile, not a
// hand-built `${n}%` template literal.
describe('buildDashboardKpis · GETALLEN-1 percent tiles use the house formatter', () => {
  it('fillRate renders through pct(), not a raw template literal', () => {
    const onNavigate: NavMock = vi.fn()
    const pct = vi.fn((v: number) => `pct(${v})`)
    const kpis = buildDashboardKpis({ ...baseArgs({ fill_rate: 82.5 }, onNavigate), pct })
    expect(kpis.fillRate.value).toBe('pct(82.5)')
    expect(pct).toHaveBeenCalledWith(82.5)
  })

  it('occupancy renders through num(), not a raw template literal', () => {
    const onNavigate: NavMock = vi.fn()
    const num = vi.fn((v?: number | null) => (v == null ? '—' : `fmt(${v})`))
    const kpis = buildDashboardKpis({ ...baseArgs({ occupancy: 63.1 }, onNavigate), num })
    expect(kpis.occupancy.value).toBe('fmt(63.1)%')
    expect(num).toHaveBeenCalledWith(63.1)
  })
})

describe('buildDashboardKpis · KPI-TARGETS-ALERT-1 target lines', () => {
  const tgt = (o: Record<string, unknown>) => ({ value: 3, target: 10, comparison: 'gte' as const, below_target: true, metric: 'm', period_scope: 'month' as const, ...o })
  const args = (targets?: Record<string, ReturnType<typeof tgt>>) => ({
    ...baseArgs({ candidates_new: 3, placements: 2, fill_rate: 40, tasks: 5, calllist_uncalled: 9, candidates_total: 7 }, vi.fn()),
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}|${o.value}|${o.target}` : k),
    pct: (v: number) => `${v}pct`,
    targets,
  })
  it('attaches the right line to the five tiles and none to others', () => {
    const k = buildDashboardKpis(args({
      new_candidates_target: tgt({}), placements_target: tgt({ below_target: false }),
      fill_rate_target: tgt({ value: 40, target: 80 }), open_tasks_target: tgt({ comparison: 'lte' }),
      uncalled_warning_threshold: tgt({ comparison: 'lte', below_target: false }),
    }))
    expect(k.candidatesNew.targetLine?.text).toBe('kpi.target.progress|3|10')
    expect(k.placements.targetLine?.tone).toBe('success')
    expect(k.fillRate.targetLine?.text).toBe('kpi.target.progress|40pct|80pct')
    expect(k.tasks.targetLine?.tone).toBe('warning')
    expect(k.uncalledCallist.targetLine?.text).toContain('kpi.target.within')
    expect(k.candidates.targetLine).toBeUndefined()
  })
  it('renders the monthOnly line on a non-month period and keeps the big number', () => {
    const k = buildDashboardKpis(args({ new_candidates_target: tgt({ below_target: null }) }))
    expect(k.candidatesNew.targetLine?.text).toContain('kpi.target.monthOnly')
    expect(k.candidatesNew.value).toBe('3')
  })
  it('carries the kpi_targets value (not the flat kpis number) and uses the ceiling kind on a non-month period', () => {
    const k = buildDashboardKpis(args({ open_tasks_target: tgt({ value: 23, target: 30, comparison: 'lte', below_target: null }), new_candidates_target: tgt({ value: 22, below_target: false }) }))
    expect(k.tasks.targetLine).toEqual({ text: 'kpi.target.monthOnlyMax|23|30', tone: 'muted' })
    expect(k.candidatesNew.targetLine?.text).toBe('kpi.target.reached|22|10')
  })
  it('renders exactly today\'s tiles when kpi_targets is absent', () => {
    const k = buildDashboardKpis(args(undefined))
    expect(Object.values(k).every(t => t.targetLine === undefined)).toBe(true)
  })
})

// CONTRACT-FOLLOW-1 (6): never_contacted_alert off -> kpis.never_contacted null: no value, no attention caption.
describe('buildDashboardKpis · never_contacted null', () => {
  it('renders a dash without the attention caption when the alert is off', () => {
    const off = buildDashboardKpis(baseArgs({ never_contacted: null }, vi.fn()))
    expect(off.never.value).toBe('—')
    expect(off.never.sub).toBe('')
    expect(off.never.onClick).toBeUndefined()
  })
  it('keeps a real zero and the caption when the alert is on', () => {
    const on = buildDashboardKpis(baseArgs({ never_contacted: 0 }, vi.fn()))
    expect(on.never.value).toBe('0')
    expect(on.never.sub).toBe('kpi.attentionNeeded')
  })
  it('uncalled tile value is kpis.calllist_uncalled (equals the threshold target value)', () => {
    const k = buildDashboardKpis({ ...baseArgs({ calllist_uncalled: 9 }, vi.fn()), targets: { uncalled_warning_threshold: { value: 9, target: 25, comparison: 'lte', below_target: false, metric: 'm', period_scope: 'month' } } })
    expect(k.uncalledCallist.value).toBe('9')
  })
})

describe('buildDashboardKpis · fill-rate tile equals its target line', () => {
  it('formats the tile value and the target-line value through the same percent formatter', () => {
    const pct = (v: number) => `${Math.round(v * 10) / 10}%`
    const args = {
      ...baseArgs({ fill_rate: 58.824 }, vi.fn() as NavMock), pct,
      t: (k: string, o?: Record<string, unknown>) => (o?.value ? String(o.value) : k),
      targets: { fill_rate_target: { value: 58.82, target: 70, comparison: 'gte' as const, below_target: true, metric: 'fill_rate', period_scope: 'month' as const } },
    }
    const tile = buildDashboardKpis(args).fillRate
    expect(tile.value).toBe(pct(58.824))
    expect(tile.targetLine?.text).toBe(tile.value)
  })
})
