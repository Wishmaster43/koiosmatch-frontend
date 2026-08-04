import { describe, it, expect } from 'vitest'
import { deriveOpportunityAdvice, isExpectedCloseOverdue, isTerminalStage } from './opportunityAdvice'
import type { Opportunity } from '@/types/opportunity'
import type { LookupOption } from '@/types/common'

const NOW = new Date('2026-08-04T12:00:00Z')
const stages: LookupOption[] = [
  { value: 'lead', label: 'Lead' } as LookupOption,
  { value: 'won', label: 'Won', isWon: true } as LookupOption,
  { value: 'lost', label: 'Lost', isLost: true } as LookupOption,
]

function makeOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return { id: 'o1', stageValue: 'lead', expectedCloseAt: '2026-07-01', ...overrides } as unknown as Opportunity
}

describe('isTerminalStage', () => {
  it('is true for a won/lost stage, false otherwise', () => {
    expect(isTerminalStage(makeOpportunity({ stageValue: 'won' }), stages)).toBe(true)
    expect(isTerminalStage(makeOpportunity({ stageValue: 'lead' }), stages)).toBe(false)
  })
})

describe('isExpectedCloseOverdue', () => {
  it('is true for a past expected-close date on a non-terminal stage', () => {
    expect(isExpectedCloseOverdue(makeOpportunity(), stages, NOW)).toBe(true)
  })

  it('is false once the deal is won/lost, even with a past date', () => {
    expect(isExpectedCloseOverdue(makeOpportunity({ stageValue: 'won' }), stages, NOW)).toBe(false)
  })

  it('is false without an expected-close date', () => {
    expect(isExpectedCloseOverdue(makeOpportunity({ expectedCloseAt: null }), stages, NOW)).toBe(false)
  })
})

describe('deriveOpportunityAdvice', () => {
  it('advises follow_up for an overdue, still-open deal', () => {
    expect(deriveOpportunityAdvice(makeOpportunity(), stages, NOW).action).toBe('follow_up')
  })

  it('advises nothing once the expected-close date is in the future', () => {
    expect(deriveOpportunityAdvice(makeOpportunity({ expectedCloseAt: '2027-01-01' }), stages, NOW).action).toBe('none')
  })
})
