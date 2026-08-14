/**
 * useCampaignAdvice — the ONE resolver shared by the outreach table column and
 * the drawer (KOIOS-ADVIES-OVERAL-1). Verifies the misconfigured-active rule
 * fires with a translated label/reason and that a healthy campaign stays null.
 */
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import '@/i18n'
import { useCampaignAdvice } from './useCampaignAdvice'
import type { Campaign } from '@/pages/outreach/hooks/useOutreachCampaigns'

// Minimal Campaign stub — only the fields the rule engine reads matter here.
function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'c1',
    status: 'active',
    targets_count: 0,
    created_at: '2026-01-01',
    ...overrides,
  } as Campaign
}

describe('useCampaignAdvice', () => {
  it('fires "attention" for an active campaign without targets, with a translated label + reason', () => {
    const { result } = renderHook(() => useCampaignAdvice())
    const advice = result.current(makeCampaign())
    expect(advice).not.toBeNull()
    expect(advice!.action).toBe('attention')
    expect(advice!.source).toBe('rules')
    expect(advice!.label).toBe('Aandacht')
    expect(advice!.reason).toBe('Deze actieve bellijst heeft nog geen contacten geladen.')
  })

  it('stays null for an active campaign with targets loaded', () => {
    const { result } = renderHook(() => useCampaignAdvice())
    expect(result.current(makeCampaign({ targets_count: 25 }))).toBeNull()
  })
})
