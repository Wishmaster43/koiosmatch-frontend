/**
 * useDashboardViewModel — D6 tile visibility (no zero-tile invention, §3): the
 * recruitment KPI row includes tooLongInStage/missingApptApps only when the
 * backend actually returned that attention key. (The D1(a) vacancy tiles,
 * closingSoon/staleStatusVac, are removed entirely — DASHBOARD-OPRUIMING-1.)
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
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
  candidateTotalLabel: '0',
  matchesTotal: null,
  vacanciesTotal: null,
  ...overrides,
})

describe('useDashboardViewModel · D6 tile visibility', () => {
  it('omits the two tiles when appStats is absent', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs()))
    const ids = result.current.kpis.map(k => k.id)
    expect(ids).not.toContain('tooLongInStage')
    expect(ids).not.toContain('missingApptApps')
  })

  it('renders each tile once its backend key is present', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      appStats: { attention: { too_long_in_stage: 3, missing_appointment: 2 } },
    })))
    const ids = result.current.kpis.map(k => k.id)
    expect(ids).toEqual(expect.arrayContaining(['tooLongInStage', 'missingApptApps']))
  })
})

describe('useDashboardViewModel · KD11 (DASHP36) missing-documents null-hide', () => {
  it('omits the missingDocs tile when attention.missing_documents is null (no CV-type flagged)', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'backoffice' as const,
      stats: { attention: { missing_documents: null } },
    })))
    expect(result.current.kpis.map(k => k.id)).not.toContain('missingDocs')
  })

  it('renders the missingDocs tile once the backend returns a real count', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'backoffice' as const,
      stats: { attention: { missing_documents: 4 } },
    })))
    expect(result.current.kpis.map(k => k.id)).toContain('missingDocs')
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
        customers_by_owner: [{ owner_id: 5, name: 'Team A', count: 12 }],
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

    // The sales_manager breakdown never navigates — it's an aggregate, not a record.
    expect(result.current.customersByOwnerRows[0].onClick).toBeUndefined()
    expect(result.current.customersByOwnerRows[0].primary).toBe('Team A')
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

// DASHBOARD-OPRUIMING-1 (Danny 23-08, verbatim: "recruiter management dashboard
// moet nu zelfde zijn als management omdat alles ruk is, maar nu heb ik een leeg
// gat — dus maak hetzelfde"): recruitment_manager mirrors management verbatim —
// the '*' wildcard, so every block is visible, and management's own KPI row.
describe('useDashboardViewModel · recruitment_manager mirrors management', () => {
  it('shows every block under the "*" wildcard, exactly like management', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({ activeType: 'recruitment_manager' as const })))
    for (const id of ['chart.status', 'chart.recruiter', 'chart.funnel', 'chart.funnelConversion', 'chart.weekly', 'list.candidates', 'list.applications', 'list.conversations', 'list.runs']) {
      expect(result.current.vis(id), `${id} should be visible for recruitment_manager`).toBe(true)
    }
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
    const managementResult = renderHook(() => useDashboardViewModel(baseArgs({ activeType: 'management' as const }))).result
    expect(result.current.kpis.map(k => k.id)).toEqual(managementResult.current.kpis.map(k => k.id))
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
