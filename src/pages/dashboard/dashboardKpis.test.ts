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

// Minimal args builder — only the fields these tiles read.
const baseArgs = (att: Record<string, number | null | undefined>, onNavigate: ReturnType<typeof vi.fn>) => ({
  t: (k: string) => k,
  att,
  num: (v?: number | null) => (v == null ? '—' : String(v)),
  eur: (v?: unknown) => String(v),
  opp: null,
  valueInHours: false,
  candidateTotalLabel: '0',
  matchesTotal: null,
  vacanciesTotal: null,
  incompleteRuns: 0,
  conversationsCount: 0,
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
