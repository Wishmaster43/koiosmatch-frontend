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
