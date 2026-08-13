/**
 * dashboardKpis — D6/D1(a) tile→intent mapping (the seam, per CLAUDE.md §13):
 * the tiles emit a SEMANTIC intent ({ attention: '<name>' }), the house
 * convention (onNavigate('candidates', { attention: 'stale6m' }), CandidatesPage:113)
 * — never a raw server filter param. The destination page's own consumption of
 * that intent is asserted separately (ApplicationsPage.test.tsx / VacanciesPage.test.tsx).
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

describe('buildDashboardKpis · D6/D1(a) attention tiles', () => {
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

  it('closingSoon navigates to /vacancies with the closingSoon intent', () => {
    const onNavigate = vi.fn()
    const kpis = buildDashboardKpis(baseArgs({ vac_closing_soon: 5 }, onNavigate))
    kpis.closingSoon.onClick?.()
    expect(onNavigate).toHaveBeenCalledWith('vacancies', { attention: 'closingSoon' })
  })

  it('staleStatusVac navigates to /vacancies with the staleStatus intent', () => {
    const onNavigate = vi.fn()
    const kpis = buildDashboardKpis(baseArgs({ vac_stale_status: 1 }, onNavigate))
    kpis.staleStatusVac.onClick?.()
    expect(onNavigate).toHaveBeenCalledWith('vacancies', { attention: 'staleStatus' })
  })
})
