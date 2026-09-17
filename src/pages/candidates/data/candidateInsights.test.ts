/**
 * candidateInsights test — verify KPI card building, including the new
 * retention-expiring card (RETENTIE-KLIK-1).
 */
import { describe, it, expect, vi } from 'vitest'
import type { TFunction } from 'i18next'
import { buildCandidateInsights } from './candidateInsights'

const t: TFunction = ((k: string, opts?: Record<string, unknown>) => {
  if (k === 'analytics.staleMonths' && opts?.months) return `Not contacted > ${opts.months} mo`
  const labels: Record<string, string> = {
    'analytics.staleMonths': 'Not contacted > {{months}} mo',
    'analytics.stale6mSub': 'no contact for a while',
    'analytics.neverContacted': 'Never contacted',
    'analytics.neverContactedSub': 'no contact moment yet',
    'analytics.noFollowup': 'No follow-up',
    'analytics.noFollowupSub': 'no appointment, no task, no recent contact',
    'kpi.intake': 'Intake planned',
    'kpi.intakeSub': 'upcoming intakes',
    'analytics.conversations': 'Active conversations',
    'kpi.tasks': 'Tasks',
    'kpi.tasksSub': 'Open candidate tasks',
    'insights.retentionExpiring': 'Retention expiring',
    'insights.retentionExpiringSub': '{{count}} within 30 days',
  }
  let result = labels[k] || k
  if (opts?.count) result = result.replace('{{count}}', String(opts.count))
  return result
}) as unknown as TFunction

describe('buildCandidateInsights — retention expiring KPI card', () => {
  it('includes the retention expiring card with 60-day value and 30-day sub-line', () => {
    const { kpis } = buildCandidateInsights({
      t,
      statusData: [], funnelData: [], rcData: [],
      pickStatus: vi.fn(), pickFunnel: vi.fn(), pickOwner: vi.fn(), pickPhase: vi.fn(),
      entryPhase: 'lead',
      selectedStatus: [], setSelectedStatus: vi.fn(),
      selectedPhase: [], setSelectedPhase: vi.fn(),
      selectedFunnel: [], setSelectedFunnel: vi.fn(),
      selectedOwner: [], setSelectedOwner: vi.fn(),
      attentionFilter: null, toggleAttention: vi.fn(),
      staleMonths: 6,
      counts: {
        stale: 10, neverContacted: 5, noFollowup: null, intake: 3, activeConv: 2, tasks: 1,
        retentionExpiring30: 7, retentionExpiring60: 15,
      },
    })
    const card = kpis.find((k: { key: string }) => k.key === 'retentionExpiring')
    expect(card).toBeDefined()
    expect(card!.label).toBe('Retention expiring')
    expect(card!.value).toBe(15)
    expect(card!.sub).toContain('7 within 30 days')
  })

  it('retention expiring card toggles retentionExpiring60 on click', () => {
    const toggleAttention = vi.fn()
    const { kpis } = buildCandidateInsights({
      t,
      statusData: [], funnelData: [], rcData: [],
      pickStatus: vi.fn(), pickFunnel: vi.fn(), pickOwner: vi.fn(), pickPhase: vi.fn(),
      entryPhase: 'lead',
      selectedStatus: [], setSelectedStatus: vi.fn(),
      selectedPhase: [], setSelectedPhase: vi.fn(),
      selectedFunnel: [], setSelectedFunnel: vi.fn(),
      selectedOwner: [], setSelectedOwner: vi.fn(),
      attentionFilter: null, toggleAttention,
      staleMonths: 6,
      counts: {
        stale: 10, neverContacted: 5, noFollowup: null, intake: 3, activeConv: 2, tasks: 1,
        retentionExpiring30: 7, retentionExpiring60: 15,
      },
    })
    const card = kpis.find((k: { key: string }) => k.key === 'retentionExpiring')
    card!.onClick?.()
    expect(toggleAttention).toHaveBeenCalledWith('retentionExpiring60')
  })

  it('retention expiring card shows as active when attentionFilter is retentionExpiring60', () => {
    const { kpis } = buildCandidateInsights({
      t,
      statusData: [], funnelData: [], rcData: [],
      pickStatus: vi.fn(), pickFunnel: vi.fn(), pickOwner: vi.fn(), pickPhase: vi.fn(),
      entryPhase: 'lead',
      selectedStatus: [], setSelectedStatus: vi.fn(),
      selectedPhase: [], setSelectedPhase: vi.fn(),
      selectedFunnel: [], setSelectedFunnel: vi.fn(),
      selectedOwner: [], setSelectedOwner: vi.fn(),
      attentionFilter: 'retentionExpiring60', toggleAttention: vi.fn(),
      staleMonths: 6,
      counts: {
        stale: 10, neverContacted: 5, noFollowup: null, intake: 3, activeConv: 2, tasks: 1,
        retentionExpiring30: 7, retentionExpiring60: 15,
      },
    })
    const card = kpis.find((k: { key: string }) => k.key === 'retentionExpiring')
    expect(card!.active).toBe(true)
  })
})

/**
 * AUDIT-NAFIX-1 (STATS-HONEST-1) — tasks/retentionExpiring counts are null (not
 * 0) when the stats endpoint has no value; the card must show the house dash
 * and drop its click-through rather than reading as a confident zero.
 */
describe('buildCandidateInsights — STATS-HONEST-1 null counts', () => {
  const argsWithCounts = (counts: Parameters<typeof buildCandidateInsights>[0]['counts']) => ({
    t,
    statusData: [], funnelData: [], rcData: [],
    pickStatus: vi.fn(), pickFunnel: vi.fn(), pickOwner: vi.fn(), pickPhase: vi.fn(),
    entryPhase: 'lead',
    selectedStatus: [], setSelectedStatus: vi.fn(),
    selectedPhase: [], setSelectedPhase: vi.fn(),
    selectedFunnel: [], setSelectedFunnel: vi.fn(),
    selectedOwner: [], setSelectedOwner: vi.fn(),
    attentionFilter: null, toggleAttention: vi.fn(),
    staleMonths: 6,
    counts,
  })

  it('renders the house dash and no onClick for a null tasks count', () => {
    const { kpis } = buildCandidateInsights(argsWithCounts({
      stale: 10, neverContacted: 5, noFollowup: null, intake: 3, activeConv: 2, tasks: null,
      retentionExpiring30: 7, retentionExpiring60: 15,
    }))
    const card = kpis.find((k: { key: string }) => k.key === 'tasks')
    expect(card!.value).toBe('—')
    expect(card!.onClick).toBeUndefined()
  })

  it('renders the house dash and no onClick for a null retentionExpiring60 count', () => {
    const { kpis } = buildCandidateInsights(argsWithCounts({
      stale: 10, neverContacted: 5, noFollowup: null, intake: 3, activeConv: 2, tasks: 1,
      retentionExpiring30: null, retentionExpiring60: null,
    }))
    const card = kpis.find((k: { key: string }) => k.key === 'retentionExpiring')
    expect(card!.value).toBe('—')
    expect(card!.sub).toBeUndefined()
    expect(card!.onClick).toBeUndefined()
  })

  it('still clicks through and shows the real value for a non-null count', () => {
    const { kpis } = buildCandidateInsights(argsWithCounts({
      stale: 10, neverContacted: 5, noFollowup: null, intake: 3, activeConv: 2, tasks: 4,
      retentionExpiring30: 7, retentionExpiring60: 15,
    }))
    const tasksCard = kpis.find((k: { key: string }) => k.key === 'tasks')
    expect(tasksCard!.value).toBe(4)
    expect(typeof tasksCard!.onClick).toBe('function')
  })
})
