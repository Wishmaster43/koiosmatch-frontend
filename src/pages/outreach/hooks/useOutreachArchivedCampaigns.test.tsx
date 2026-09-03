/**
 * useOutreachArchivedCampaigns — the lazy archived/trash fetch + its alive
 * guard (OUTREACH-HOOK-TESTS-1, Opus review LOW-12). Covers the four UI
 * states (idle/loading/success/error) plus a STALE-RESPONSE regression: the
 * alive flag is re-armed in the effect setup and torn down in its cleanup
 * (§9 "every entity-keyed load effect carries an alive guard"), so a
 * superseded run's late response must never overwrite fresher state.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { ListResult } from '@/types/api'
import { useOutreachArchivedCampaigns } from './useOutreachArchivedCampaigns'
import { listCampaigns } from '../data/outreachApi'
import type { Campaign } from './useOutreachCampaigns'

vi.mock('../data/outreachApi', () => ({ listCampaigns: vi.fn() }))

afterEach(() => vi.clearAllMocks())

// Builds a well-formed listCampaigns() resolution (mirrors unwrapList's shape).
const listResult = (rows: Campaign[]): ListResult<Campaign> =>
  ({ rows, total: rows.length, page: 1, lastPage: 1, perPage: rows.length })

describe('useOutreachArchivedCampaigns · idle (neither quick view open)', () => {
  it('never fetches and stays empty when both showArchived and showTrash are false', () => {
    const { result } = renderHook(() => useOutreachArchivedCampaigns(false, false))
    expect(listCampaigns).not.toHaveBeenCalled()
    expect(result.current.archived).toEqual([])
    expect(result.current.archLoading).toBe(false)
    expect(result.current.archError).toBe(false)
  })
})

describe('useOutreachArchivedCampaigns · loading -> success', () => {
  it('fetches with archived=1, is loading synchronously, then resolves into the archived list', async () => {
    const rows: Campaign[] = [{ id: 'a1', name: 'Oude bellijst', archived: true }]
    vi.mocked(listCampaigns).mockResolvedValue(listResult(rows))
    const { result } = renderHook(() => useOutreachArchivedCampaigns(true, false))
    // The effect sets loading synchronously, before the (async) fetch resolves.
    expect(result.current.archLoading).toBe(true)
    await waitFor(() => expect(result.current.archLoading).toBe(false))
    expect(listCampaigns).toHaveBeenCalledWith({ archived: 1 })
    expect(result.current.archived).toEqual(rows)
    expect(result.current.archError).toBe(false)
  })
})

describe('useOutreachArchivedCampaigns · error state', () => {
  it('reports archError and keeps the list empty on a rejected fetch (no fabricated fallback)', async () => {
    vi.mocked(listCampaigns).mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useOutreachArchivedCampaigns(false, true))
    await waitFor(() => expect(result.current.archLoading).toBe(false))
    expect(result.current.archError).toBe(true)
    expect(result.current.archived).toEqual([])
  })
})

describe('useOutreachArchivedCampaigns · stale response never wins', () => {
  it('discards a late response from a superseded effect run once refetchArchived starts a newer one', async () => {
    // Deferred promises resolved by hand, in whatever order we choose — proves the
    // OLD run's response can arrive AFTER the newer one and still lose, instead of
    // relying on timing.
    const deferreds: Array<{ resolve: (v: ListResult<Campaign>) => void }> = []
    vi.mocked(listCampaigns).mockImplementation(() => new Promise((resolve) => { deferreds.push({ resolve }) }))

    const { result } = renderHook(() => useOutreachArchivedCampaigns(true, false))
    await waitFor(() => expect(deferreds).toHaveLength(1))

    // Bump `tick` before the first fetch ever resolves — the effect's cleanup runs
    // (alive=false for run #1) and a fresh run #2 starts (alive=true).
    act(() => { result.current.refetchArchived() })
    await waitFor(() => expect(deferreds).toHaveLength(2))

    // Run #2's (fresh) response arrives first and wins.
    act(() => { deferreds[1].resolve(listResult([{ id: 'fresh' }])) })
    await waitFor(() => expect(result.current.archived).toEqual([{ id: 'fresh' }]))

    // Run #1's (stale) response arrives late — must NOT overwrite the fresh state.
    act(() => { deferreds[0].resolve(listResult([{ id: 'stale' }])) })
    await Promise.resolve()
    expect(result.current.archived).toEqual([{ id: 'fresh' }])
  })
})

describe('useOutreachArchivedCampaigns · lifecycleOf tolerant read', () => {
  it('reads the real lifecycle field, falling back for payloads that predate it', () => {
    const { result } = renderHook(() => useOutreachArchivedCampaigns(false, false))
    expect(result.current.lifecycleOf({ id: 'a', lifecycle: 'pending_erase' } as Campaign)).toBe('pending_erase')
    expect(result.current.lifecycleOf({ id: 'b', deleted_at: '2026-08-01' } as Campaign)).toBe('archived')
    expect(result.current.lifecycleOf({ id: 'c' } as Campaign)).toBe('active')
  })
})

describe('useOutreachArchivedCampaigns · removeArchived optimistic drop', () => {
  it('drops the given row from the archived list without waiting for a refetch', async () => {
    const rows: Campaign[] = [{ id: 'a1' }, { id: 'a2' }]
    vi.mocked(listCampaigns).mockResolvedValue(listResult(rows))
    const { result } = renderHook(() => useOutreachArchivedCampaigns(true, false))
    await waitFor(() => expect(result.current.archived).toHaveLength(2))

    act(() => { result.current.removeArchived('a1') })
    expect(result.current.archived).toEqual([{ id: 'a2' }])
  })
})
