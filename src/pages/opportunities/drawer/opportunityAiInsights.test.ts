/**
 * buildOpportunityAdviceInsights — deal-magnitude + close-date-window readings,
 * pure FE heuristic. `now` is always fixed here (§13).
 */
import { describe, it, expect } from 'vitest'
import { buildOpportunityAdviceInsights } from './opportunityAiInsights'
import type { Opportunity } from '@/types/opportunity'
import type { LookupOption } from '@/types/common'

const NOW = new Date('2026-08-22T10:00:00')
const t = (key: string, opts?: Record<string, unknown>) => `${key}${opts ? `:${JSON.stringify(opts)}` : ''}`

const stages: LookupOption[] = [
  { value: 'open', label: 'Open' },
  { value: 'won', label: 'Gewonnen', isWon: true },
  { value: 'lost', label: 'Verloren', isLost: true },
]

const base: Opportunity = {
  id: 'o1', title: 'Deal A', description: '', initials: 'DA', client: 'Acme', clientId: 'c1',
  stage: 'Open', stageValue: 'open', stageColor: '', value: null, currency: 'EUR', owner: '', ownerId: null,
  date: '2026-01-01', expectedCloseAt: null, dealTypeUnit: null, archived: false, archivedAt: null,
  lifecycle: 'active', pendingEraseAt: null, hours: null, hoursPeriod: 'week', startDate: null, endDate: null,
  serviceType: '', serviceTypeValue: null, serviceTypeColor: '', serviceTypeId: null,
  agreementType: '', agreementTypeValue: null, agreementTypeColor: '', agreementTypeId: null,
  location: '', locationId: null, department: '', departmentId: null, contact: '', contactId: null,
  branch: '', branchId: null, tags: [], customFieldValues: {},
} as unknown as Opportunity

describe('buildOpportunityAdviceInsights · deal magnitude health', () => {
  it('flags a deal with no value AND no hours as missing', () => {
    const [magnitude] = buildOpportunityAdviceInsights(base, stages, t, NOW)
    expect(magnitude.text).toBe('ai.dealHealthMissing')
    expect(magnitude.color).toBe('var(--color-warning)')
  })

  it('reads a filled euro value as set', () => {
    const [magnitude] = buildOpportunityAdviceInsights({ ...base, value: 12500 }, stages, t, NOW)
    expect(magnitude.text).toBe('ai.dealHealthSet')
    expect(magnitude.color).toBe('var(--color-success)')
  })

  it('reads a filled hours figure as set too (either field counts)', () => {
    const [magnitude] = buildOpportunityAdviceInsights({ ...base, hours: 40 }, stages, t, NOW)
    expect(magnitude.text).toBe('ai.dealHealthSet')
  })
})

describe('buildOpportunityAdviceInsights · close-date window', () => {
  it('reads unknown when there is no expected close date', () => {
    const [, closeWindow] = buildOpportunityAdviceInsights({ ...base, expectedCloseAt: null }, stages, t, NOW)
    expect(closeWindow.text).toBe('ai.closeWindowUnknown')
  })

  it('flags an overdue open deal as a warning', () => {
    const [, closeWindow] = buildOpportunityAdviceInsights({ ...base, expectedCloseAt: '2026-08-15' }, stages, t, NOW)
    expect(closeWindow.text).toContain('ai.closeWindowOverdue')
    expect(closeWindow.text).toContain('"days":7')
    expect(closeWindow.color).toBe('var(--color-warning)')
  })

  it('reads a comfortably future close date as fine', () => {
    const [, closeWindow] = buildOpportunityAdviceInsights({ ...base, expectedCloseAt: '2026-09-01' }, stages, t, NOW)
    expect(closeWindow.text).toContain('ai.closeWindowUpcoming')
    expect(closeWindow.color).toBe('var(--color-success)')
  })

  it('shows the terminal note for a WON deal even with an overdue close date', () => {
    const won = { ...base, stageValue: 'won', expectedCloseAt: '2026-01-01' }
    const [, closeWindow] = buildOpportunityAdviceInsights(won, stages, t, NOW)
    expect(closeWindow.text).toBe('ai.closeWindowTerminal')
    expect(closeWindow.color).toBe('var(--text-muted)')
  })

  it('shows the terminal note for a LOST deal too', () => {
    const lost = { ...base, stageValue: 'lost', expectedCloseAt: '2026-01-01' }
    const [, closeWindow] = buildOpportunityAdviceInsights(lost, stages, t, NOW)
    expect(closeWindow.text).toBe('ai.closeWindowTerminal')
  })
})
