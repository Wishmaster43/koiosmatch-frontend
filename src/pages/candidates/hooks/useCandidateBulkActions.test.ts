/**
 * useCandidateBulkActions — mirrors the useVacancyBulkActions.test.ts harness
 * (real useState so we can observe optimistic update → reconcile/revert), plus
 * the candidate-only archive-guard flow (§3B): a pre-check blocks the confirm
 * dialog when a live application/match hangs on the selection, and a 409 with
 * the forward-compat `{ live }` payload re-opens the same guard as a safety net.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { useCandidateBulkActions } from './useCandidateBulkActions'
import type { Candidate } from '@/types/candidate'
import type { Id, LookupOption } from '@/types/common'
import type { LookupItem } from '@/context/LookupsContext'

// Keep the real unwrap (archiveGuard.ts uses it) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})
import api from '@/lib/api'

const get   = api.get    as unknown as ReturnType<typeof vi.fn>
const post  = api.post   as unknown as ReturnType<typeof vi.fn>
const del   = api.delete as unknown as ReturnType<typeof vi.fn>
const notify = vi.fn()
const t = ((k: string) => k) as unknown as import('i18next').TFunction

// A non-terminal ('proposal') + a terminal ('hired', is_match) funnel stage —
// enough to exercise needsLiveCheck's flag-driven terminal check (archiveGuard.ts).
const FUNNEL: LookupItem[] = [
  { value: 'applied',  label: 'Applied',  color: 'slate' },
  { value: 'proposal', label: 'Proposed', color: 'slate' },
  { value: 'hired',    label: 'Hired',    color: 'slate', is_match: true },
]
const CANDIDATE_TYPES: LookupOption[] = [{ value: 'flex', label: 'Flex' }, { value: 'zzp', label: 'ZZP' }]

const cand = (overrides: Partial<Candidate> = {}): Candidate => ({
  id: 1, name: 'Test candidate', stage: '', status: 'available',
  pools: [], tags: [], candidateTypes: [], owner: '',
  ...overrides,
} as Candidate)

// Harness: real state, so we can observe optimistic update → reconcile/revert.
function harness(initial: Candidate[]) {
  return renderHook(() => {
    const [candidates, setCandidates] = useState<Candidate[]>(initial)
    const [total, setTotal] = useState(initial.length)
    const [selectedIds, setSelectedIds] = useState<Set<Id>>(new Set())
    const actions = useCandidateBulkActions({
      candidates, setCandidates, setTotal, selectedIds, setSelectedIds, notify, t,
      funnelTypes: FUNNEL, candidateTypes: CANDIDATE_TYPES,
    })
    return { candidates, total, setSelectedIds, actions }
  })
}
const rowOf = (r: { result: { current: { candidates: Candidate[] } } }, id: Id) => r.result.current.candidates.find(c => c.id === id)

beforeEach(() => { notify.mockClear(); get.mockReset(); post.mockReset(); del.mockReset() })

describe('useCandidateBulkActions · bulkSetOwner (bulkMutate optimistic/reconcile)', () => {
  it('patches optimistically, keeps confirmed rows, reverts skipped ones on partial reconcile', async () => {
    post.mockResolvedValue({ data: { updated: [1] } })
    const r = harness([cand({ id: 1, owner: 'Old' }), cand({ id: 2, owner: 'Old' })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkSetOwner({ id: 9, name: 'New Owner' }))
    expect(rowOf(r, 1)?.owner).toBe('New Owner') // optimistic on both
    expect(rowOf(r, 2)?.owner).toBe('New Owner')
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', expect.any(String)))
    expect(rowOf(r, 1)?.owner).toBe('New Owner') // confirmed → stays
    expect(rowOf(r, 2)?.owner).toBe('Old')       // skipped by server → reverted
  })

  it('reverts everything and toasts the generic mutate error when the call fails', async () => {
    post.mockRejectedValue(new Error('boom'))
    const r = harness([cand({ id: 1, owner: 'Old' })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.bulkSetOwner({ id: 9, name: 'New' }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('error', 'bulk.mutateError'))
    expect(rowOf(r, 1)?.owner).toBe('Old')
  })
})

describe('useCandidateBulkActions · pool add/remove', () => {
  it('bulkAddToPool adds the chip optimistically and reverts candidates the server didn\'t confirm', async () => {
    post.mockResolvedValue({ data: { added: [1] } })
    const r = harness([cand({ id: 1, pools: [] }), cand({ id: 2, pools: [] })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkAddToPool({ id: 'p1', name: 'Pool A' }))
    expect(rowOf(r, 1)?.pools).toHaveLength(1) // optimistic on both
    expect(rowOf(r, 2)?.pools).toHaveLength(1)
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', expect.any(String)))
    expect(rowOf(r, 1)?.pools).toHaveLength(1) // confirmed
    expect(rowOf(r, 2)?.pools).toHaveLength(0) // reverted
  })

  it('bulkRemoveFromPool removes the chip optimistically and restores it on failure', async () => {
    del.mockRejectedValue(new Error('x'))
    const r = harness([cand({ id: 1, pools: [{ id: 'p1', name: 'Pool A' }] })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.bulkRemoveFromPool({ id: 'p1', name: 'Pool A' }))
    expect(rowOf(r, 1)?.pools).toHaveLength(0) // optimistic
    await waitFor(() => expect(notify).toHaveBeenCalledWith('error', 'bulk.poolError'))
    expect(rowOf(r, 1)?.pools).toHaveLength(1) // restored
  })
})

describe('useCandidateBulkActions · bulkSetTypes (exact-set multi-select)', () => {
  it('sets the exact type set on the selection, including clearing to empty', async () => {
    post.mockResolvedValue({ data: { updated: [1] } })
    const r = harness([cand({ id: 1, candidateTypes: ['flex'] })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.bulkSetTypes([]))
    expect(rowOf(r, 1)?.candidateTypes).toEqual([]) // optimistic clear
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', expect.any(String)))
    expect(post).toHaveBeenCalledWith('/candidates/bulk/candidate-type', { candidate_ids: [1], candidate_types: [] })
  })
})

describe('useCandidateBulkActions · tags', () => {
  it('bulkAddTag adds optimistically and reverts candidates the server skipped', async () => {
    post.mockResolvedValue({ data: { updated: [1] } })
    const r = harness([cand({ id: 1, tags: [] }), cand({ id: 2, tags: [] })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkAddTag('vip'))
    expect(rowOf(r, 1)?.tags).toEqual(['vip'])
    expect(rowOf(r, 2)?.tags).toEqual(['vip'])
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', expect.any(String)))
    expect(rowOf(r, 1)?.tags).toEqual(['vip'])
    expect(rowOf(r, 2)?.tags).toEqual([])
  })

  it('bulkRemoveTag removes optimistically and restores it on failure', async () => {
    post.mockRejectedValue(new Error('x'))
    const r = harness([cand({ id: 1, tags: ['vip'] })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.bulkRemoveTag('vip'))
    expect(rowOf(r, 1)?.tags).toEqual([])
    await waitFor(() => expect(notify).toHaveBeenCalledWith('error', 'bulk.mutateError'))
    expect(rowOf(r, 1)?.tags).toEqual(['vip'])
  })
})

describe('useCandidateBulkActions · note / phase / consent', () => {
  it('bulkAddNote never patches a row — toast only', async () => {
    post.mockResolvedValue({ data: { updated: [1] } })
    const r = harness([cand({ id: 1 })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.bulkAddNote('Called, no answer'))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', expect.any(String)))
    expect(post).toHaveBeenCalledWith('/candidates/bulk/notes', { candidate_ids: [1], text: 'Called, no answer' })
  })

  it('bulkConvertPhase warns (not success) when fewer candidates were updated than selected', async () => {
    post.mockResolvedValue({ data: { updated: [1] } })
    const r = harness([cand({ id: 1 }), cand({ id: 2 })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkConvertPhase('candidate'))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('warning', expect.any(String)))
  })

  it('bulkSetConsent patches no row field (no list column) but still confirms via toast', async () => {
    post.mockResolvedValue({ data: { updated: [1] } })
    const r = harness([cand({ id: 1 })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.bulkSetConsent({ whatsapp_opt_in: true }, 'WhatsApp'))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', expect.any(String)))
    expect(post).toHaveBeenCalledWith('/candidates/bulk/consent', { candidate_ids: [1], consent: { whatsapp_opt_in: true } })
  })
})

describe('useCandidateBulkActions · bulkArchive (guard)', () => {
  it('archives straight away (after confirm) when none of the selection is risky — no pre-check fetch', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    post.mockResolvedValue({ data: { archived: [1] } })
    const r = harness([cand({ id: 1, stage: '', status: 'available' })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    await act(async () => { await r.result.current.actions.bulkArchive() })
    expect(get).not.toHaveBeenCalled()
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', expect.any(String)))
    expect(r.result.current.candidates).toHaveLength(0)
    expect(r.result.current.total).toBe(0)
  })

  it('does nothing when the confirm dialog is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const r = harness([cand({ id: 1, stage: '', status: 'available' })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    await act(async () => { await r.result.current.actions.bulkArchive() })
    expect(post).not.toHaveBeenCalled()
    expect(r.result.current.candidates).toHaveLength(1)
  })

  it('pre-checks a risky candidate (non-terminal funnel stage) and opens the guard modal instead of archiving', async () => {
    get.mockImplementation((url: string) => {
      if (url === '/candidates/1') return Promise.resolve({ data: { data: {
        applications: [{ id: 'a1', vacancyTitle: 'X', stageLabel: 'Y', stageColor: null }], matches: [],
      } } })
      if (url === '/applications/a1') return Promise.resolve({ data: { data: { phase_key: 'proposal' } } })
      return Promise.reject(new Error('unexpected ' + url))
    })
    const r = harness([cand({ id: 1, stage: 'proposal', status: 'available' })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    await act(async () => { await r.result.current.actions.bulkArchive() })
    expect(get).toHaveBeenCalledWith('/candidates/1')
    expect(post).not.toHaveBeenCalled()
    expect(r.result.current.actions.bulkArchiveGuard).toMatchObject({ ids: [1], blockedCount: 1, totalCount: 1 })
    expect(r.result.current.actions.bulkArchiveGuard?.applications).toHaveLength(1)
  })

  it('resolveBulkArchiveGuard re-runs the real archive once every blocker is resolved', async () => {
    get.mockImplementation((url: string) => {
      if (url === '/candidates/1') return Promise.resolve({ data: { data: {
        applications: [{ id: 'a1', vacancyTitle: 'X', stageLabel: 'Y', stageColor: null }], matches: [],
      } } })
      if (url === '/applications/a1') return Promise.resolve({ data: { data: { phase_key: 'proposal' } } })
      return Promise.reject(new Error('unexpected ' + url))
    })
    post.mockResolvedValue({ data: { archived: [1] } })
    const r = harness([cand({ id: 1, stage: 'proposal', status: 'available' })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    await act(async () => { await r.result.current.actions.bulkArchive() })
    expect(r.result.current.actions.bulkArchiveGuard).not.toBeNull()

    await act(async () => { r.result.current.actions.resolveBulkArchiveGuard() })
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', expect.any(String)))
    expect(r.result.current.candidates).toHaveLength(0)
  })

  it('a 409 with a forward-compat `live` payload on the real call re-opens the guard (safety net for a missed pre-check)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    post.mockRejectedValue({ response: { status: 409, data: { live: { applications: [{ id: 'a1' }], matches: [] } } } })
    // Row-level pre-filter says "safe" (empty stage, not placed) — the 409 is the last line of defence.
    const r = harness([cand({ id: 1, stage: '', status: 'available' })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    await act(async () => { await r.result.current.actions.bulkArchive() })
    expect(r.result.current.actions.bulkArchiveGuard).toMatchObject({ ids: [1] })
    expect(r.result.current.candidates).toHaveLength(1) // not removed — still blocked
  })
})
