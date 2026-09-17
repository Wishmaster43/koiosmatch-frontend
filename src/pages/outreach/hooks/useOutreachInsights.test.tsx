/**
 * useOutreachInsights — donut/KPI/board-column derivation for the outreach
 * page (OUTREACH-HOOK-TESTS-1, Opus review LOW-12). Real i18n (nl, the
 * eagerly-bundled fallback locale) so labels resolve to genuine translated
 * text instead of raw keys; colours are read from the shared STATUSES/
 * CHANNELS data constant (never hardcoded here — the hex-stop lint guard
 * also flags ad-hoc hex literals, §4).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import '@/i18n'
import nlOutreach from '@/i18n/locales/nl/outreach.json'
import { useOutreachInsights } from './useOutreachInsights'
import { STATUSES, CHANNELS } from '../data/outreachCampaignFields'
import type { Campaign } from './useOutreachCampaigns'

type Args = Parameters<typeof useOutreachInsights>[0]

// Two statuses (active/draft), two channels (call/email) — 'done' and
// 'whatsapp' stay at zero so the "non-empty bucket only" donut rule is exercised.
const campaigns: Campaign[] = [
  { id: 'c1', status: 'active', channel: 'call', targets_count: 3, owner: { id: 'u1', name: 'Nora' } },
  { id: 'c2', status: 'active', channel: 'email', targets_count: 2, owner: { id: 'u2', name: 'Sara' } },
  { id: 'c3', status: 'draft', channel: 'call', targets_count: 0 },
]

const colorOf = (defs: { key: string; color: string }[], key: string) => defs.find((d) => d.key === key)!.color

function build(overrides: Partial<Args> = {}) {
  const args: Args = {
    campaigns,
    selectedStatus: [], setSelectedStatus: vi.fn(),
    selectedChannel: [], setSelectedChannel: vi.fn(),
    kpiTargets: false, setKpiTargets: vi.fn(),
    ...overrides,
  }
  return renderHook(() => useOutreachInsights(args))
}

describe('useOutreachInsights · donut buckets (nl labels)', () => {
  it('counts only non-empty status buckets, in STATUSES order, labelled via the real nl locale', () => {
    const { result } = build()
    expect(result.current.statusData).toEqual([
      { name: nlOutreach.status.draft, key: 'draft', color: colorOf(STATUSES, 'draft'), value: 1 },
      { name: nlOutreach.status.active, key: 'active', color: colorOf(STATUSES, 'active'), value: 2 },
    ])
    // 'done' has zero campaigns — never rendered as an empty donut slice.
    expect(result.current.statusData.find((d) => d.key === 'done')).toBeUndefined()
  })

  it('counts only non-empty channel buckets, in CHANNELS order', () => {
    const { result } = build()
    expect(result.current.channelData).toEqual([
      { name: nlOutreach.channel.call, key: 'call', color: colorOf(CHANNELS, 'call'), value: 2 },
      { name: nlOutreach.channel.email, key: 'email', color: colorOf(CHANNELS, 'email'), value: 1 },
    ])
    expect(result.current.channelData.find((d) => d.key === 'whatsapp')).toBeUndefined()
  })

  it('board columns list every fixed status, including ones with zero campaigns', () => {
    const { result } = build()
    expect(result.current.columns).toEqual([
      { key: 'draft', label: nlOutreach.status.draft, color: colorOf(STATUSES, 'draft') },
      { key: 'active', label: nlOutreach.status.active, color: colorOf(STATUSES, 'active') },
      { key: 'done', label: nlOutreach.status.done, color: colorOf(STATUSES, 'done') },
    ])
  })
})

describe('useOutreachInsights · owner filter options', () => {
  it('derives distinct owner names with counts from the loaded rows, never a hardcoded list', () => {
    const { result } = build()
    expect(result.current.ownerOptions).toEqual([
      { value: 'Nora', label: 'Nora', count: 1 },
      { value: 'Sara', label: 'Sara', count: 1 },
    ])
  })

  it('target-group options stay empty when no campaign carries a pool_name', () => {
    const { result } = build()
    expect(result.current.targetGroupOptions).toEqual([])
  })
})

describe('useOutreachInsights · KPI cards', () => {
  it('total/active/targets values match the loaded rows, labelled via the real nl locale', () => {
    const { result } = build()
    const total = result.current.insightKpis.find((k) => k.key === 'total')
    const active = result.current.insightKpis.find((k) => k.key === 'active')
    const targets = result.current.insightKpis.find((k) => k.key === 'targets')
    expect(total).toMatchObject({ label: nlOutreach.kpi.total, value: 3, sub: nlOutreach.kpi.totalSub })
    expect(active).toMatchObject({ label: nlOutreach.kpi.active, value: 2, sub: nlOutreach.kpi.activeSub })
    expect(targets).toMatchObject({ label: nlOutreach.kpi.targets, value: 5, sub: nlOutreach.kpi.targetsSub })
  })
})

describe('useOutreachInsights · KPI-RIJ-9-1 (9 cards, 4 from the server aggregate)', () => {
  it('renders 2 donuts + 7 KPI cards (9 total)', () => {
    const { result } = build({ stats: { called_today: 3, to_call: 2, reached_pct: 66.7, overdue: 1 } })
    expect(result.current.insightDonuts).toHaveLength(2)
    expect(result.current.insightKpis).toHaveLength(7)
  })

  it('the 4 new cards read the server aggregate, plain (no click-to-filter)', () => {
    const { result } = build({ stats: { called_today: 3, to_call: 2, reached_pct: 66.7, overdue: 1 } })
    const calledToday = result.current.insightKpis.find((k) => k.key === 'calledToday')
    const toCall = result.current.insightKpis.find((k) => k.key === 'toCall')
    const reachedPct = result.current.insightKpis.find((k) => k.key === 'reachedPct')
    const overdue = result.current.insightKpis.find((k) => k.key === 'overdue')
    expect(calledToday).toMatchObject({ value: 3 })
    expect(calledToday?.onClick).toBeUndefined()
    expect(toCall).toMatchObject({ value: 2 })
    expect(reachedPct?.value).toBe('66,7%') // formatPercent on nl-NL, a VALUE not a share (EENHEID-LES)
    expect(overdue).toMatchObject({ value: 1 })
    expect(overdue?.onClick).toBeUndefined()
  })

  it('shows null (house dash), never a fabricated 0, while stats have not loaded', () => {
    const { result } = build({ stats: undefined })
    expect(result.current.insightKpis.find((k) => k.key === 'calledToday')?.value).toBeNull()
    expect(result.current.insightKpis.find((k) => k.key === 'reachedPct')?.value).toBeNull()
  })

  it('a null reached_pct (nothing attempted yet) renders the dash, not 0%', () => {
    const { result } = build({ stats: { called_today: 0, to_call: 0, reached_pct: null, overdue: 0 } })
    expect(result.current.insightKpis.find((k) => k.key === 'reachedPct')?.value).toBe('—')
  })
})

describe('useOutreachInsights · click-to-filter', () => {
  it('the status donut onPick sets a single value, then clears on a repeated click of the same value', () => {
    const setSelectedStatus = vi.fn()
    const { result } = build({ setSelectedStatus })
    result.current.insightDonuts[0].onPick?.({ key: 'active' })
    const updater = setSelectedStatus.mock.calls[0][0] as (p: string[]) => string[]
    expect(updater([])).toEqual(['active'])
    expect(updater(['active'])).toEqual([])
  })

  it('the channel donut onClear resets only the channel selection', () => {
    const setSelectedChannel = vi.fn()
    const { result } = build({ selectedChannel: ['call'], setSelectedChannel })
    result.current.insightDonuts[1].onClear?.()
    expect(setSelectedChannel).toHaveBeenCalledWith([])
  })

  it('the "total" KPI card resets status, channel and the targets toggle', () => {
    const setSelectedStatus = vi.fn(); const setSelectedChannel = vi.fn(); const setKpiTargets = vi.fn()
    const { result } = build({ setSelectedStatus, setSelectedChannel, setKpiTargets })
    result.current.insightKpis.find((k) => k.key === 'total')?.onClick?.()
    expect(setSelectedStatus).toHaveBeenCalledWith([])
    expect(setSelectedChannel).toHaveBeenCalledWith([])
    expect(setKpiTargets).toHaveBeenCalledWith(false)
  })

  it('the "targets" KPI card flips the kpiTargets toggle', () => {
    const setKpiTargets = vi.fn()
    const { result } = build({ kpiTargets: false, setKpiTargets })
    result.current.insightKpis.find((k) => k.key === 'targets')?.onClick?.()
    const updater = setKpiTargets.mock.calls[0][0] as (v: boolean) => boolean
    expect(updater(false)).toBe(true)
  })
})
