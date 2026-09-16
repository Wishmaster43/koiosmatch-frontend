/**
 * useMatchesInsights — GETALLEN-1: the avgScore KPI value goes through the
 * locale percent formatter, never a hand-built `${n}%` string.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMatchesInsights } from './useMatchesInsights'
import type { MatchRow } from '@/types/match'

const t = ((k: string) => k) as unknown as import('i18next').TFunction
const noop = vi.fn()

function baseArgs(overrides: Partial<Parameters<typeof useMatchesInsights>[0]> = {}) {
  return {
    rows: [] as MatchRow[], t, matchStatusMeta: () => undefined,
    seedLabel: (_k: string, o: { label: string }) => o.label,
    monthStart: 0, query: '', setQuery: noop,
    stageFilter: [], setStageFilter: noop, ownerFilter: [], setOwnerFilter: noop,
    clientFilter: [], setClientFilter: noop, branchFilter: [], setBranchFilter: noop,
    contractFormFilter: [], setContractFormFilter: noop, contractTypeFilter: [], setContractTypeFilter: noop,
    contractTypeLookupOptions: [],
    kpiScored: false, setKpiScored: noop, kpiUnscored: false, setKpiUnscored: noop,
    dateRange: null, setDateRange: noop, showArchived: false, setShowArchived: noop,
    showTrash: false, setShowTrash: noop,
    pendingApprovalOnly: false, setPendingApprovalOnly: noop, approvalReviewVisible: false,
    pendingApprovalCount: null,
    registerFilters: noop, unregisterFilters: noop,
    ...overrides,
  }
}

describe('useMatchesInsights · avgScore KPI', () => {
  it('formats the average score through the locale percent formatter', () => {
    const rows = [{ score: 88 }, { score: 76 }] as unknown as MatchRow[]
    const { result } = renderHook(() => useMatchesInsights(baseArgs({ rows })))
    const avgScore = result.current.insightKpis.find(k => k.key === 'avgScore')
    // (88+76)/2 = 82 → locale-formatted "82%", never a bare template literal.
    expect(avgScore?.value).toBe('82%')
  })

  it('shows a dash, never a fabricated 0%, when there are no scored rows', () => {
    const { result } = renderHook(() => useMatchesInsights(baseArgs({ rows: [] })))
    const avgScore = result.current.insightKpis.find(k => k.key === 'avgScore')
    expect(avgScore?.value).toBe('—')
  })
})
