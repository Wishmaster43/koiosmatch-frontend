/**
 * useDashboardViewModel — D6/D1(a) tile visibility (no zero-tile invention, §3):
 * the recruitment KPI row includes tooLongInStage/missingApptApps/closingSoon/
 * staleStatusVac only when the backend actually returned that attention key.
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

describe('useDashboardViewModel · D6/D1(a) tile visibility', () => {
  it('omits the four new tiles when appStats/vacStats are absent', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs()))
    const ids = result.current.kpis.map(k => k.id)
    expect(ids).not.toContain('tooLongInStage')
    expect(ids).not.toContain('missingApptApps')
    expect(ids).not.toContain('closingSoon')
    expect(ids).not.toContain('staleStatusVac')
  })

  it('renders each tile once its backend key is present', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      appStats: { attention: { too_long_in_stage: 3, missing_appointment: 2 } },
      vacStats: { attention: { closing_soon: 5, stale_status: 1 } },
    })))
    const ids = result.current.kpis.map(k => k.id)
    expect(ids).toEqual(expect.arrayContaining(['tooLongInStage', 'missingApptApps', 'closingSoon', 'staleStatusVac']))
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
  it('maps expiring_matches/stale_leads/stale_vacancies/koios_suggestions to click-through rows', () => {
    const onNavigate = vi.fn()
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      activeType: 'sales_manager' as const,
      dash: {
        expiring_matches: [{ id: 1, candidate_name: 'Jan Jansen', customer_name: 'Acme', end_date: '2026-09-01' }],
        stale_leads: [{ id: 2, name: 'Piet Pos', phase_changed_at: '2026-07-01' }],
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

    result.current.staleLeadsRows[0].onClick?.()
    expect(onNavigate).toHaveBeenCalledWith('candidates', { open: 2 })

    result.current.staleVacanciesRows[0].onClick?.()
    expect(onNavigate).toHaveBeenCalledWith('vacancies', { open: 3 })

    result.current.koiosSuggestionsRows[0].onClick?.()
    expect(onNavigate).toHaveBeenCalledWith('vacancies', { open: 4 })

    // The sales_manager breakdown never navigates — it's an aggregate, not a record.
    expect(result.current.customersByOwnerRows[0].onClick).toBeUndefined()
    expect(result.current.customersByOwnerRows[0].primary).toBe('Team A')
  })

  it('falls back to the customer name when candidate_name is PII-redacted (null, no candidates.view)', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      dash: { expiring_matches: [{ id: 1, candidate_name: null, customer_name: 'Acme', end_date: '2026-09-01' }] },
    })))
    expect(result.current.expiringMatchesRows[0].primary).toBe('Acme')
    expect(result.current.expiringMatchesRows[0].secondary).toBeUndefined()
  })
})
