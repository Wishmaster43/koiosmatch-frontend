import { describe, it, expect } from 'vitest'
import {
  getReportKpiCatalog, getReportKpiDefaultOrder, reportHasSpareKpiCards,
} from './kpiCatalog'

// REPORTS-KPI-SPARES-1: intakes/outreach/ai/workflows each grew real spare cards
// beyond their nine defaults — the settings screen picker (ReportKpiSettings)
// reads these two functions directly, so covering them here proves the picker
// has something new to offer without needing to mount the whole settings screen.
describe('kpiCatalog — REPORTS-KPI-SPARES-1 spare cards', () => {
  it.each([
    ['intakes', ['unassignedRecruiter', 'topLocation', 'topRegion', 'avgPerRecruiter']],
    ['outreach', ['topStatus', 'topOutcome', 'campaignsCount', 'channelsUsed', 'assigneesCount']],
    ['ai', ['topModel', 'topUser', 'avgPerUser', 'avgPerActivityType']],
    ['workflows', ['topWorkflow', 'topTrigger', 'failureRate', 'avgRunsPerWorkflow']],
  ] as const)('%s catalogue offers its new spare keys', (scopeId, spareKeys) => {
    const catalogKeys = getReportKpiCatalog(scopeId).map(c => c.key)
    for (const key of spareKeys) {
      expect(catalogKeys).toContain(key)
    }
  })

  it.each(['intakes', 'outreach', 'ai', 'workflows'] as const)(
    '%s default order stays exactly nine keys once spares are appended',
    (scopeId) => {
      expect(getReportKpiDefaultOrder(scopeId)).toHaveLength(9)
    },
  )

  it.each(['intakes', 'outreach', 'ai', 'workflows'] as const)(
    '%s now reports real spare cards to the settings screen',
    (scopeId) => {
      expect(reportHasSpareKpiCards(scopeId)).toBe(true)
    },
  )

  // A default (never-configured) tenant must still see today's exact nine keys,
  // in today's order — appending spares must never reshuffle the default strip.
  it('intakes default order is unchanged by the appended spares', () => {
    expect(getReportKpiDefaultOrder('intakes')).toEqual([
      'total', 'recruitersCount', 'locationsCount', 'sourcesCount',
      'functionsCount', 'regionsCount', 'topRecruiter', 'topSource', 'topFunction',
    ])
  })

  it('workflows default order is unchanged by the appended spares', () => {
    expect(getReportKpiDefaultOrder('workflows')).toEqual([
      'runs', 'completed', 'failed', 'cancelled', 'running',
      'successRate', 'avgDuration', 'workflowsCount', 'triggersCount',
    ])
  })

  it('no catalogue offers the same key twice', () => {
    for (const scopeId of ['intakes', 'outreach', 'ai', 'workflows'] as const) {
      const keys = getReportKpiCatalog(scopeId).map(c => c.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })
})

// REPORTS-KPI-SPARE-1: vacancies/opportunities/tasks/matches each grew four real
// spare cards beyond their nine defaults, mirroring the sweep above.
describe('kpiCatalog — REPORTS-KPI-SPARE-1 spare cards (vacancies/opportunities/tasks/matches)', () => {
  it.each([
    ['vacancies', ['longConcept', 'noMatches', 'topFunction', 'topBranch']],
    ['opportunities', ['openValue', 'wonValue', 'topStage', 'topCustomer']],
    ['tasks', ['topStatus', 'topType', 'topPriority', 'topAssignee']],
    ['matches', ['noContract', 'topContractForm', 'topTerminationReason', 'funnelRate']],
  ] as const)('%s catalogue offers its new spare keys', (scopeId, spareKeys) => {
    const catalogKeys = getReportKpiCatalog(scopeId).map(c => c.key)
    for (const key of spareKeys) {
      expect(catalogKeys).toContain(key)
    }
  })

  it.each(['vacancies', 'opportunities', 'tasks', 'matches'] as const)(
    '%s default order stays exactly nine keys once spares are appended',
    (scopeId) => {
      expect(getReportKpiDefaultOrder(scopeId)).toHaveLength(9)
    },
  )

  it.each(['vacancies', 'opportunities', 'tasks', 'matches'] as const)(
    '%s now reports real spare cards to the settings screen',
    (scopeId) => {
      expect(reportHasSpareKpiCards(scopeId)).toBe(true)
    },
  )

  it('vacancies default order is unchanged by the appended spares', () => {
    expect(getReportKpiDefaultOrder('vacancies')).toEqual([
      'total', 'open', 'filled', 'fillRate', 'ttf', 'staleOnline', 'customersCount', 'topIndustry', 'topOwner',
    ])
  })

  it('matches default order is unchanged by the appended spares', () => {
    expect(getReportKpiDefaultOrder('matches')).toEqual([
      'total', 'funnel', 'direct', 'sent', 'active', 'ended', 'terminationsTotal', 'dur', 'terminationRate',
    ])
  })

  it('no catalogue offers the same key twice', () => {
    for (const scopeId of ['vacancies', 'opportunities', 'tasks', 'matches'] as const) {
      const keys = getReportKpiCatalog(scopeId).map(c => c.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })
})
