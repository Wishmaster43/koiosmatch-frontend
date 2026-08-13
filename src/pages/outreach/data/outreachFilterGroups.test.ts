/**
 * buildOutreachFilterGroups — seam test for the new right-panel (status/
 * channel/owner/target-group/archived), the whole panel for this page (parity
 * sweep, half 2 — outreach had NO right panel wired up before this). Asserts
 * the archived group's onToggle flips the SAME showArchived flag OutreachPage
 * sends to `listCampaigns({ archived: 1 })`, and owner/target-group groups
 * disappear entirely when there is no data (never render an empty group).
 */
import { describe, it, expect, vi } from 'vitest'
import '@/i18n'
import i18n from '@/i18n'
import { buildOutreachFilterGroups } from './outreachFilterGroups'

const tog = (set: (fn: (p: string[]) => string[]) => void) => (v: string) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])

function build(overrides: Partial<Parameters<typeof buildOutreachFilterGroups>[0]> = {}) {
  const setShowArchived = vi.fn()
  const args = {
    t: i18n.getFixedT('nl', 'outreach'),
    tog,
    selectedStatus: [], setSelectedStatus: vi.fn(),
    selectedChannel: [], setSelectedChannel: vi.fn(),
    selectedOwner: [], setSelectedOwner: vi.fn(),
    selectedTargetGroup: [], setSelectedTargetGroup: vi.fn(),
    showArchived: false, setShowArchived,
    statusOptions: [{ value: 'active', label: 'Active', count: 2 }],
    channelOptions: [{ value: 'call', label: 'Call', count: 2 }],
    ownerOptions: [{ value: 'Jane', label: 'Jane', count: 1 }],
    targetGroupOptions: [],
    ...overrides,
  } as Parameters<typeof buildOutreachFilterGroups>[0]
  return { groups: buildOutreachFilterGroups(args), setShowArchived }
}

describe('buildOutreachFilterGroups · full right panel (parity, half 2)', () => {
  it('emits an archived checkbox group whose onToggle flips the request-driving flag', () => {
    const { groups, setShowArchived } = build()
    const archived = groups.find(g => g.key === 'archived') as unknown as { onToggle: () => void }
    archived.onToggle()
    const updater = setShowArchived.mock.calls[0][0] as (v: boolean) => boolean
    expect(updater(false)).toBe(true)
  })

  it('always emits status + channel, sourced from the passed aggregates', () => {
    const { groups } = build()
    expect(groups.find(g => g.key === 'status')?.options).toEqual([{ value: 'active', label: 'Active', count: 2 }])
    expect(groups.find(g => g.key === 'channel')?.options).toEqual([{ value: 'call', label: 'Call', count: 2 }])
  })

  it('emits owner only when there is data, omits target-group when there is none', () => {
    const { groups } = build()
    expect(groups.find(g => g.key === 'owner')).toBeTruthy()
    expect(groups.find(g => g.key === 'targetGroup')).toBeUndefined()
  })

  it('emits target-group once data exists', () => {
    const { groups } = build({ targetGroupOptions: [{ value: 'Pool A', label: 'Pool A', count: 3 }] } as Partial<Parameters<typeof buildOutreachFilterGroups>[0]>)
    expect(groups.find(g => g.key === 'targetGroup')?.options).toEqual([{ value: 'Pool A', label: 'Pool A', count: 3 }])
  })
})
