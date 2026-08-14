/**
 * useOpportunityAdvice — the ONE resolver shared by the opportunities table
 * column and the drawer (KOIOS-ADVIES-OVERAL-1). Verifies the overdue rule
 * fires for an open deal past its expected close and that a terminal
 * (won/lost) stage suppresses it.
 */
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import '@/i18n'
import { useOpportunityAdvice } from './useOpportunityAdvice'
import type { Opportunity } from '@/types/opportunity'
import type { LookupOption } from '@/types/common'

// Stage lookup with one terminal (won) stage — decides "overdue" vs. "closed".
const stages = [
  { value: 'open', label: 'Open' },
  { value: 'won', label: 'Won', isWon: true },
] as LookupOption[]

// Minimal Opportunity stub — only the fields the rule engine reads matter here.
function makeOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 1,
    stageValue: 'open',
    expectedCloseAt: new Date(Date.now() - 2 * 864e5).toISOString(),
    ...overrides,
  } as Opportunity
}

describe('useOpportunityAdvice', () => {
  it('fires "follow_up" for an open deal past its expected close, with a translated label + reason', () => {
    const { result } = renderHook(() => useOpportunityAdvice(stages))
    const advice = result.current(makeOpportunity())
    expect(advice).not.toBeNull()
    expect(advice!.action).toBe('follow_up')
    expect(advice!.source).toBe('rules')
    expect(advice!.label).toBe('Opvolgen')
    expect(advice!.reason).toBe('De verwachte sluitingsdatum is verstreken. Volg deze kans op.')
  })

  it('stays null for a terminal (won) stage and for a deal without an expected close date', () => {
    const { result } = renderHook(() => useOpportunityAdvice(stages))
    expect(result.current(makeOpportunity({ stageValue: 'won' }))).toBeNull()
    expect(result.current(makeOpportunity({ expectedCloseAt: null }))).toBeNull()
  })
})
