import { describe, it, expect } from 'vitest'
import { deriveCampaignAdvice } from './campaignAdvice'
import type { Campaign } from '../hooks/useOutreachCampaigns'

const NOW = new Date('2026-08-04T12:00:00Z')

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return { id: 'c1', status: 'draft', targets_count: 0, created_at: '2026-08-01', archived: false, ...overrides }
}

describe('deriveCampaignAdvice', () => {
  it('advises attention for an active campaign with zero targets', () => {
    const rule = deriveCampaignAdvice(makeCampaign({ status: 'active', targets_count: 0 }), NOW)
    expect(rule.action).toBe('attention')
  })

  it('advises nothing for an active campaign that has targets', () => {
    const rule = deriveCampaignAdvice(makeCampaign({ status: 'active', targets_count: 5 }), NOW)
    expect(rule.action).toBe('none')
  })

  it('advises attention for a stale draft that already has targets loaded', () => {
    const rule = deriveCampaignAdvice(makeCampaign({ status: 'draft', targets_count: 5, created_at: '2026-07-01' }), NOW)
    expect(rule.action).toBe('attention')
  })

  it('advises nothing for a fresh draft, even with targets loaded', () => {
    const rule = deriveCampaignAdvice(makeCampaign({ status: 'draft', targets_count: 5, created_at: '2026-08-03' }), NOW)
    expect(rule.action).toBe('none')
  })

  it('advises nothing for a done campaign', () => {
    const rule = deriveCampaignAdvice(makeCampaign({ status: 'done', targets_count: 0 }), NOW)
    expect(rule.action).toBe('none')
  })

  it('never advises on an archived campaign', () => {
    const rule = deriveCampaignAdvice(makeCampaign({ status: 'active', targets_count: 0, archived: true }), NOW)
    expect(rule.action).toBe('none')
  })
})
