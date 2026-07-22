/**
 * Guard test (§13): every KPI id in KPI_ROWS must exist in buildDashboardKpis's
 * output. A stale id (e.g. the removed WhatsApp-personal `failedWa`/`waQueue`
 * ids) silently drops a KPI card via `.filter(Boolean)` in useDashboardViewModel
 * — this test turns that silent drop into a failing test instead.
 */
import { describe, it, expect } from 'vitest'
import { buildDashboardKpis } from './dashboardKpis'
import { KPI_ROWS } from './templates'

describe('dashboard KPI row guard', () => {
  // Minimal stub args — only the shape matters, not the values, for id resolution.
  const kpiById = buildDashboardKpis({
    t: (k: string) => k,
    att: {},
    num: () => '',
    eur: () => '',
    opp: null,
    valueInHours: false,
    candidateTotalLabel: '',
    matchesTotal: null,
    vacanciesTotal: null,
    incompleteRuns: 0,
    conversationsCount: 0,
  })
  const knownIds = new Set(Object.keys(kpiById))

  // Every role's row must resolve to a real KPI — no id gets silently dropped.
  for (const [role, ids] of Object.entries(KPI_ROWS)) {
    it(`${role} KPI row only references ids that exist in buildDashboardKpis`, () => {
      const unknown = ids.filter(id => !knownIds.has(id))
      expect(unknown, `${role} references unknown KPI ids: ${unknown.join(', ')}`).toEqual([])
    })
  }
})
