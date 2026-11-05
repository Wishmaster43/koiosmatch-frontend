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
import { baseArgs } from './useDashboardViewModel.testKit'

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
