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

// Minimal args builder — only the fields these tiles read. K1: KPI values come
// from the server `kpis` block now, not att/opp/meta-total fallbacks.
const baseArgs = (kpis: Record<string, number | null | undefined>, onNavigate: ReturnType<typeof vi.fn>) => ({
  t: (k: string) => k,
  kpis,
  num: (v?: number | null) => (v == null ? '—' : String(v)),
  eur: (v?: unknown) => String(v),
  opp: null,
  valueInHours: false,
  candidateTotalLabel: '0',
  onNavigate,
})

describe('buildDashboardKpis · D6 attention tiles', () => {
  it('tooLongInStage navigates to /applications with the tooLongInStage intent', () => {
    const onNavigate = vi.fn()
    const kpis = buildDashboardKpis(baseArgs({ app_too_long_in_stage: 3 }, onNavigate))
    kpis.tooLongInStage.onClick?.()
    expect(onNavigate).toHaveBeenCalledWith('applications', { attention: 'tooLongInStage' })
  })

  it('missingApptApps navigates to /applications with the missingAppointment intent', () => {
    const onNavigate = vi.fn()
    const kpis = buildDashboardKpis(baseArgs({ app_missing_appointment: 2 }, onNavigate))
    kpis.missingApptApps.onClick?.()
    expect(onNavigate).toHaveBeenCalledWith('applications', { attention: 'missingAppointment' })
  })

  // DASHBOARD-OPRUIMING-1 (Danny 23-08): closingSoon/staleStatusVac (the vacancy
  // KPI tiles) are removed entirely — pin their absence, not their behaviour.
  it('no longer builds the removed closingSoon/staleStatusVac KPI tiles', () => {
    const onNavigate = vi.fn()
    const kpis = buildDashboardKpis(baseArgs({ vac_closing_soon: 5, vac_stale_status: 1 }, onNavigate))
    expect(kpis.closingSoon).toBeUndefined()
    expect(kpis.staleStatusVac).toBeUndefined()
  })
})

// K1 (DASH-KPI-SERVER-FE-1, BE K-168) — every KPI value comes exclusively from
// the server `kpis` block now, never a client-side fallback.
describe('buildDashboardKpis · K1 server-computed values', () => {
  it('reads a KPI value from kpis, not from any other source', () => {
    const onNavigate = vi.fn()
    const kpis = buildDashboardKpis(baseArgs({ open_vacancies: 7 }, onNavigate))
    expect(kpis.openVacancies.value).toBe('7')
  })

  it('null in kpis renders the dash placeholder', () => {
    const onNavigate = vi.fn()
    const kpis = buildDashboardKpis(baseArgs({ placements: null }, onNavigate))
    expect(kpis.placements.value).toBe('—')
  })

  it('a response without kpis at all never crashes and shows placeholders', () => {
    const onNavigate = vi.fn()
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
    const onNavigate = vi.fn()
    // Exactly what DashboardService::drills emits for a recruiter's stale tile.
    const args = { ...baseArgs({ stale_6m: 4 }, onNavigate), drills: { stale_6m: { entity: 'candidates', params: { stale_6m: 1, owner_id: 'u-1', location_id: 'l-1' } } } }
    const kpis = buildDashboardKpis(args)
    kpis.stale.onClick?.()
    expect(onNavigate).toHaveBeenCalledWith('candidates', { attention: 'stale6m', owner: 'u-1', location: 'l-1' })
  })

  it('translates the tasks drill (open + assignee scope) into the tasks intent', () => {
    const onNavigate = vi.fn()
    const args = { ...baseArgs({ tasks: 7 }, onNavigate), drills: { tasks: { entity: 'tasks', params: { open: 1, assignee_id: 'u-1' } } } }
    const kpis = buildDashboardKpis(args)
    kpis.tasks.onClick?.()
    expect(onNavigate).toHaveBeenCalledWith('tasks', { kpi: 'open', assignee: 'u-1' })
  })

  it('translates the missing_documents drill into the candidates missingDocs intent', () => {
    const onNavigate = vi.fn()
    const args = { ...baseArgs({ missing_documents: 2 }, onNavigate), drills: { missing_documents: { entity: 'candidates', params: { missing_documents: 1 } } } }
    const kpis = buildDashboardKpis(args)
    kpis.missingDocs.onClick?.()
    expect(onNavigate).toHaveBeenCalledWith('candidates', { attention: 'missingDocs' })
  })

  it('translates the coupling_errors drill into the coupling-errors page; an untranslated entity still falls back', () => {
    const onNavigate = vi.fn()
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
    const onNavigate = vi.fn()
    const args = { ...baseArgs({ stale_6m: 4 }, onNavigate), drills: { stale_6m: null } }
    const kpis = buildDashboardKpis(args)
    expect(kpis.stale.onClick).toBeUndefined()
  })

  it('an absent drills key falls back to the tile own hardcoded intent (pre-K-173 server)', () => {
    const onNavigate = vi.fn()
    const kpis = buildDashboardKpis(baseArgs({ stale_6m: 4 }, onNavigate))
    kpis.stale.onClick?.()
    expect(onNavigate).toHaveBeenCalledWith('candidates', { attention: 'stale6m' })
  })
})
