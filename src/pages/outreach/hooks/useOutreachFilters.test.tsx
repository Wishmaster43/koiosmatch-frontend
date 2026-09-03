/**
 * useOutreachFilters — client-side filter state + the derived row set
 * (OUTREACH-HOOK-TESTS-1, Opus review LOW-12). Covers status/channel
 * narrowing (and their intersection), the targets-only KPI toggle, the
 * free-text search, the archived/trash base-row switch, and that
 * clearOwnFilters resets every dimension this hook owns while leaving the
 * page-owned showArchived/showTrash flags untouched (by design — see the
 * hook's own file docblock).
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOutreachFilters } from './useOutreachFilters'
import type { Campaign } from './useOutreachCampaigns'

type Args = Parameters<typeof useOutreachFilters>[0]

// Tolerant lifecycle reader, mirrors useOutreachArchivedCampaigns's own version.
const lifecycleOf = (c?: Campaign) => c?.lifecycle ?? (c?.deleted_at || c?.archived ? 'archived' : 'active')

const campaigns: Campaign[] = [
  { id: 'c1', name: 'Zorg bellijst', status: 'active', channel: 'call', targets_count: 3, owner: { id: 'u1', name: 'Nora' } },
  { id: 'c2', name: 'Bouw mailing', status: 'draft', channel: 'email', targets_count: 0, owner: { id: 'u2', name: 'Sara' } },
  { id: 'c3', name: 'Kantoor whatsapp', status: 'active', channel: 'whatsapp', targets_count: 5 },
]

// Renders the hook with sane defaults, letting each test override just the
// dimension it cares about (mirrors useApplicationFilters.test.ts's idiom).
function build(overrides: Partial<Args> = {}) {
  const args: Args = { campaigns, archived: [], lifecycleOf, showArchived: false, showTrash: false, ...overrides }
  return renderHook(() => useOutreachFilters(args))
}

describe('useOutreachFilters · baseline (no filter set)', () => {
  it('returns the whole active list and reports no filter active', () => {
    const { result } = build()
    expect(result.current.filtered).toEqual(campaigns)
    expect(result.current.anyFilterActive).toBe(false)
  })
})

describe('useOutreachFilters · status + channel narrowing', () => {
  it('narrows to the selected status', () => {
    const { result } = build()
    act(() => { result.current.setSelectedStatus(['active']) })
    expect(result.current.filtered.map((c) => c.id)).toEqual(['c1', 'c3'])
    expect(result.current.anyFilterActive).toBe(true)
  })

  it('intersects an active status pick with a channel pick', () => {
    const { result } = build()
    act(() => { result.current.setSelectedStatus(['active']) })
    act(() => { result.current.setSelectedChannel(['whatsapp']) })
    expect(result.current.filtered.map((c) => c.id)).toEqual(['c3'])
  })
})

describe('useOutreachFilters · kpiTargets + free-text search', () => {
  it('kpiTargets keeps only rows with at least one target', () => {
    const { result } = build()
    act(() => { result.current.setKpiTargets(true) })
    expect(result.current.filtered.map((c) => c.id)).toEqual(['c1', 'c3'])
  })

  it('query text-searches the name, case-insensitively', () => {
    const { result } = build()
    act(() => { result.current.setQuery('BOUW') })
    expect(result.current.filtered.map((c) => c.id)).toEqual(['c2'])
  })
})

describe('useOutreachFilters · archived/trash base rows', () => {
  const archived: Campaign[] = [
    { id: 'a1', name: 'Archived list', status: 'done', lifecycle: 'archived' },
    { id: 'a2', name: 'Trashed list', status: 'done', lifecycle: 'pending_erase' },
  ]

  it('shows only archived-lifecycle rows while showArchived is on', () => {
    const { result } = build({ archived, showArchived: true })
    expect(result.current.filtered.map((c) => c.id)).toEqual(['a1'])
  })

  it('shows only pending_erase rows while showTrash is on (trash wins over archived)', () => {
    const { result } = build({ archived, showArchived: true, showTrash: true })
    expect(result.current.filtered.map((c) => c.id)).toEqual(['a2'])
  })
})

describe('useOutreachFilters · clearOwnFilters', () => {
  it('resets every dimension this hook owns and bumps searchEpoch', () => {
    const { result } = build()
    act(() => {
      result.current.setSelectedStatus(['active']); result.current.setSelectedChannel(['call'])
      result.current.setSelectedOwner(['Nora']); result.current.setSelectedTargetGroup(['Pool A'])
      result.current.setKpiTargets(true); result.current.setQuery('zorg')
    })
    const epochBefore = result.current.searchEpoch
    act(() => { result.current.clearOwnFilters() })
    expect(result.current.selectedStatus).toEqual([])
    expect(result.current.selectedChannel).toEqual([])
    expect(result.current.selectedOwner).toEqual([])
    expect(result.current.selectedTargetGroup).toEqual([])
    expect(result.current.kpiTargets).toBe(false)
    expect(result.current.query).toBe('')
    expect(result.current.searchEpoch).toBe(epochBefore + 1)
    expect(result.current.filtered).toEqual(campaigns)
  })

  it('cannot clear the page-owned showArchived/showTrash flags — anyFilterActive still reflects them', () => {
    const { result } = build({ showArchived: true })
    act(() => { result.current.clearOwnFilters() })
    // The hook only resets its OWN dimensions; the page composes the full clear-all
    // by also resetting showArchived/showTrash itself (see the hook's docblock).
    expect(result.current.anyFilterActive).toBe(true)
  })
})
