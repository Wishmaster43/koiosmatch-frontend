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
// 11.1: manageByApplication's deep-link goes through the shared NavigationContext
// (mirrors EntityLink) — spy on `navigate`, no provider needed for the default stub.
const navigate = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: vi.fn(), navigate }) }))

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

beforeEach(() => { notify.mockClear(); get.mockReset(); post.mockReset(); del.mockReset(); navigate.mockClear() })

describe('useCandidateBulkActions · bulkSetOwner (bulkMutate optimistic/reconcile)', () => {
  it('patches optimistically, keeps confirmed rows, reverts skipped ones on partial reconcile', async () => {
    post.mockResolvedValue({ data: { updated: [1] } })
    const r = harness([cand({ id: 1, owner: 'Old' }), cand({ id: 2, owner: 'Old' })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkSetOwner({ id: 9, name: 'New Owner' }))
    expect(rowOf(r, 1)?.owner).toBe('New Owner') // optimistic on both
    expect(rowOf(r, 2)?.owner).toBe('New Owner')
    // Job 42: 1 of 2 confirmed → a partial reconcile now WARNS with the shared
    // "N of M, Z skipped" summary — it must never read as a plain, silent success.
    await waitFor(() => expect(notify).toHaveBeenCalledWith('warning', 'bulk.partialResult'))
    expect(rowOf(r, 1)?.owner).toBe('New Owner') // confirmed → stays
    expect(rowOf(r, 2)?.owner).toBe('Old')       // skipped by server → reverted
  })

  it('reports the full success message (not the partial one) when every row is confirmed', async () => {
    post.mockResolvedValue({ data: { updated: [1] } })
    const r = harness([cand({ id: 1, owner: 'Old' })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.bulkSetOwner({ id: 9, name: 'New Owner' }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', 'bulk.ownerChanged'))
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
    // Job 42: only 1 of the 2 changed rows was confirmed → warn, don't say "success".
    await waitFor(() => expect(notify).toHaveBeenCalledWith('warning', 'bulk.partialResult'))
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
    // Job 42: only 1 of the 2 candidates that needed the tag was confirmed → warn.
    await waitFor(() => expect(notify).toHaveBeenCalledWith('warning', 'bulk.partialResult'))
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

// BULK-FUNNEL-SOLE-1/42: bulkSetStage drives the bulk funnel-stage action
// (candidates/bulk/funnel-stage), which the BE resolves against each candidate's ONE-
// AND-ONLY live application (no vacancy scope — a candidate with 0 or >1 live
// applications is `skipped`, never silently dropped from the count or guessed at).
describe('useCandidateBulkActions · bulkSetStage (funnel-stage, BULK-FUNNEL-SOLE-1/42)', () => {
  it('reports the specific stage-changed success when every candidate has an application to move', async () => {
    post.mockResolvedValue({ data: { updated: [1] } })
    const r = harness([cand({ id: 1, stage: 'applied' })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.bulkSetStage('proposal'))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', 'bulk.stageChanged'))
    expect(post).toHaveBeenCalledWith('/candidates/bulk/funnel-stage', { candidate_ids: [1], funnel_type: 'proposal' })
  })

  it('warns with the shared partial-result summary when skipped is still the bare id shape (defensive fallback)', async () => {
    post.mockResolvedValue({ data: { updated: [1] } }) // candidate 2 skipped, no reason shape at all
    const r = harness([cand({ id: 1, stage: 'applied' }), cand({ id: 2, stage: '' })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkSetStage('proposal'))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('warning', 'bulk.partialResult'))
  })

  // BULK-SKIP-REASONS-1: the BE now returns skipped as [{id, reason}] — the toast
  // must show WHY (no_application / multiple_applications / …), not just a count.
  it('warns with the reasoned breakdown when skipped carries [{id, reason}]', async () => {
    post.mockResolvedValue({ data: { updated: [1], skipped: [{ id: 2, reason: 'no_application' }] } })
    const r = harness([cand({ id: 1, stage: 'applied' }), cand({ id: 2, stage: '' })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkSetStage('proposal'))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('warning', 'bulk.partialResultReasoned'))
  })
})

// 11.1: the funnel bulk-node's convenience deep-link to the Applications page,
// pre-seeding the current selection via the shared NavigationContext intent pattern.
describe('useCandidateBulkActions · manageByApplication (11.1 deep-link)', () => {
  it('navigates to the applications page carrying the selected candidate_ids', () => {
    const r = harness([cand({ id: 1 }), cand({ id: 2 })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.manageByApplication())
    expect(navigate).toHaveBeenCalledWith('applications', { candidate_ids: [1, 2] })
  })

  it('is a no-op when nothing is selected', () => {
    const r = harness([cand({ id: 1 })])
    act(() => r.result.current.actions.manageByApplication())
    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('useCandidateBulkActions · runBulkArchive (job 42 — partial archive)', () => {
  it('warns instead of a bare success when the server archives fewer than the whole selection', async () => {
    post.mockResolvedValue({ data: { archived: [1] } }) // id 2 comes back un-archived (e.g. already archived)
    const r = harness([cand({ id: 1, stage: '', status: 'available' }), cand({ id: 2, stage: '', status: 'available' })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    await act(async () => { await r.result.current.actions.bulkArchive() })
    // Confirm via the staged ConfirmDialog (replaces window.confirm).
    act(() => r.result.current.actions.dialog.props.onConfirm())
    await waitFor(() => expect(notify).toHaveBeenCalledWith('warning', 'bulk.partialResult'))
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

  // BULK-SKIP-REASONS-1: /candidates/bulk/phase now also returns skipped as
  // [{id, reason}] — the toast shows the reason breakdown instead of a bare count.
  it('bulkConvertPhase warns with the reasoned breakdown when skipped carries [{id, reason}]', async () => {
    post.mockResolvedValue({ data: { updated: [1], skipped: [{ id: 2, reason: 'missing_required_field' }] } })
    const r = harness([cand({ id: 1 }), cand({ id: 2 })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkConvertPhase('candidate'))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('warning', 'bulk.convertResultReasoned'))
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
    post.mockResolvedValue({ data: { archived: [1] } })
    const r = harness([cand({ id: 1, stage: '', status: 'available' })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    await act(async () => { await r.result.current.actions.bulkArchive() })
    expect(get).not.toHaveBeenCalled()
    // Confirm via the staged ConfirmDialog (replaces window.confirm).
    act(() => r.result.current.actions.dialog.props.onConfirm())
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', expect.any(String)))
    expect(r.result.current.candidates).toHaveLength(0)
    expect(r.result.current.total).toBe(0)
  })

  it('does nothing when the confirm dialog is cancelled', async () => {
    const r = harness([cand({ id: 1, stage: '', status: 'available' })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    await act(async () => { await r.result.current.actions.bulkArchive() })
    act(() => r.result.current.actions.dialog.props.onCancel())
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
    post.mockRejectedValue({ response: { status: 409, data: { live: { applications: [{ id: 'a1' }], matches: [] } } } })
    // Row-level pre-filter says "safe" (empty stage, not placed) — the 409 is the last line of defence.
    const r = harness([cand({ id: 1, stage: '', status: 'available' })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    await act(async () => { await r.result.current.actions.bulkArchive() })
    act(() => r.result.current.actions.dialog.props.onConfirm())
    await waitFor(() => expect(r.result.current.actions.bulkArchiveGuard).toMatchObject({ ids: [1] }))
    expect(r.result.current.candidates).toHaveLength(1) // not removed — still blocked
  })
})

// AXIS-MATRIX-2 N2 (CMFE audit R1): bulkSetStatus is the ONE bulk mutation with a
// real action-rules catalog entry (candidate.status_set) — a preflight summary runs
// BEFORE the mutate, so a block is surfaced up front (window.confirm) instead of
// only in the after-the-fact partial-result toast. `post` stands in for BOTH
// endpoints here (preflight-bulk + the real status mutate), routed by URL.
describe('useCandidateBulkActions · bulkSetStatus (AXIS-MATRIX-2 N2 bulk preflight)', () => {
  it('proceeds straight away (no confirm) when the preflight reports nothing blocked', async () => {
    post.mockImplementation((url: string) => {
      if (url === '/action-rules/preflight-bulk') return Promise.resolve({ data: { total: 2, allowed: 2, warned: 0, blocked: 0, not_found: 0, breakdown: [] } })
      if (url === '/candidates/bulk/status') return Promise.resolve({ data: { updated: [1, 2] } })
      return Promise.reject(new Error('unexpected ' + url))
    })
    const r = harness([cand({ id: 1, status: 'available' }), cand({ id: 2, status: 'available' })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    await act(async () => { r.result.current.actions.bulkSetStatus('placed', 'Geplaatst') })
    await waitFor(() => expect(post).toHaveBeenCalledWith('/candidates/bulk/status', { candidate_ids: [1, 2], status: 'placed' }))
    expect(post).toHaveBeenCalledWith('/action-rules/preflight-bulk', { action: 'candidate.status_set', candidate_ids: [1, 2] })
    // No confirm staged — the shared ConfirmDialog never opens (replaces window.confirm spy).
    expect(r.result.current.actions.dialog.props.open).toBe(false)
  })

  // 11.3: the preflight already returns sample_names[] per blocked group — the
  // confirm now names a few of them instead of only a bare count.
  it('confirms with the skip summary INCLUDING sample names, then proceeds once accepted', async () => {
    post.mockImplementation((url: string) => {
      if (url === '/action-rules/preflight-bulk') return Promise.resolve({
        data: { total: 3, allowed: 2, warned: 0, blocked: 1, not_found: 0,
          breakdown: [{ condition: 'archived', popup_code: 'P4', effect: 'block', count: 1, sample_names: ['Piet'] }] },
      })
      if (url === '/candidates/bulk/status') return Promise.resolve({ data: { updated: [1, 2] } })
      return Promise.reject(new Error('unexpected ' + url))
    })
    const r = harness([cand({ id: 1 }), cand({ id: 2 }), cand({ id: 3 })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2, 3])))
    await act(async () => { r.result.current.actions.bulkSetStatus('placed', 'Geplaatst') })
    // Staged via the shared ConfirmDialog (replaces window.confirm) — assert the message, then confirm.
    expect(r.result.current.actions.dialog.props.message).toBe('bulk.statusBlockedConfirmSample')
    act(() => r.result.current.actions.dialog.props.onConfirm())
    await waitFor(() => expect(post).toHaveBeenCalledWith('/candidates/bulk/status', { candidate_ids: [1, 2, 3], status: 'placed' }))
  })

  it('falls back to the plain blocked confirm when the preflight has no sample names', async () => {
    post.mockImplementation((url: string) => {
      if (url === '/action-rules/preflight-bulk') return Promise.resolve({
        data: { total: 3, allowed: 2, warned: 0, blocked: 1, not_found: 0,
          breakdown: [{ condition: 'archived', popup_code: 'P4', effect: 'block', count: 1, sample_names: [] }] },
      })
      return Promise.reject(new Error('unexpected ' + url))
    })
    const r = harness([cand({ id: 1 }), cand({ id: 2 }), cand({ id: 3 })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2, 3])))
    await act(async () => { r.result.current.actions.bulkSetStatus('placed', 'Geplaatst') })
    expect(r.result.current.actions.dialog.props.message).toBe('bulk.statusBlockedConfirm')
  })

  it('never mutates when the recruiter cancels the confirm', async () => {
    post.mockImplementation((url: string) => {
      if (url === '/action-rules/preflight-bulk') return Promise.resolve({
        data: { total: 2, allowed: 1, warned: 0, blocked: 1, not_found: 0,
          breakdown: [{ condition: 'archived', popup_code: 'P4', effect: 'block', count: 1, sample_names: [] }] },
      })
      return Promise.reject(new Error('unexpected ' + url))
    })
    const r = harness([cand({ id: 1 }), cand({ id: 2 })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    await act(async () => { r.result.current.actions.bulkSetStatus('placed', 'Geplaatst') })
    act(() => r.result.current.actions.dialog.props.onCancel())
    expect(post).not.toHaveBeenCalledWith('/candidates/bulk/status', expect.anything())
  })

  it('warns (no confirm dialog, no mutate) when every selected candidate is blocked', async () => {
    post.mockImplementation((url: string) => {
      if (url === '/action-rules/preflight-bulk') return Promise.resolve({
        data: { total: 1, allowed: 0, warned: 0, blocked: 1, not_found: 0,
          breakdown: [{ condition: 'archived', popup_code: 'P4', effect: 'block', count: 1, sample_names: [] }] },
      })
      return Promise.reject(new Error('unexpected ' + url))
    })
    const r = harness([cand({ id: 1 })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    await act(async () => { r.result.current.actions.bulkSetStatus('placed', 'Geplaatst') })
    await waitFor(() => expect(notify).toHaveBeenCalledWith('warning', 'bulk.statusAllBlocked'))
    expect(r.result.current.actions.dialog.props.open).toBe(false)
    expect(post).not.toHaveBeenCalledWith('/candidates/bulk/status', expect.anything())
  })

  it('is a courtesy preview, not a gate — a failed preflight fetch still lets the real mutate run', async () => {
    post.mockImplementation((url: string) => {
      if (url === '/action-rules/preflight-bulk') return Promise.reject(new Error('network hiccup'))
      if (url === '/candidates/bulk/status') return Promise.resolve({ data: { updated: [1] } })
      return Promise.reject(new Error('unexpected ' + url))
    })
    const r = harness([cand({ id: 1 })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    await act(async () => { r.result.current.actions.bulkSetStatus('placed', 'Geplaatst') })
    await waitFor(() => expect(post).toHaveBeenCalledWith('/candidates/bulk/status', { candidate_ids: [1], status: 'placed' }))
  })
})

// Punt 4: bulk-merge entry — the FIRST selected id becomes `current`, the SECOND
// prefills as the picked duplicate; [...selectedIds] preserves the click order
// since Set retains insertion order.
describe('useCandidateBulkActions · bulkMergePrompt / resolveBulkMerge (punt 4)', () => {
  it('builds the merge target from the two selected rows, first-selected as current', () => {
    const r = harness([
      cand({ id: 1, name: 'Anna Huidig', referenceNumber: 'K-1', email: 'anna@x.nl' }),
      cand({ id: 2, name: 'Anna Dubbel', referenceNumber: 'K-2', email: 'dup@x.nl' }),
    ])
    act(() => r.result.current.setSelectedIds(new Set([2, 1]))) // clicked id 2 first, then id 1
    act(() => r.result.current.actions.bulkMergePrompt())
    expect(r.result.current.actions.bulkMergeTarget).toEqual({
      current: { id: 2, name: 'Anna Dubbel', code: 'K-2', email: 'dup@x.nl' },
      other: { id: 1, name: 'Anna Huidig', code: 'K-1', email: 'anna@x.nl' },
    })
  })

  it('is a no-op guard when the selection is not exactly 2 (defensive — the bulk bar already gates this)', () => {
    const r = harness([cand({ id: 1 }), cand({ id: 2 }), cand({ id: 3 })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2, 3])))
    act(() => r.result.current.actions.bulkMergePrompt())
    expect(r.result.current.actions.bulkMergeTarget).toBeNull()
  })

  it('resolveBulkMerge closes the modal and clears the selection', () => {
    const r = harness([cand({ id: 1 }), cand({ id: 2 })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkMergePrompt())
    expect(r.result.current.actions.bulkMergeTarget).not.toBeNull()
    act(() => r.result.current.actions.resolveBulkMerge())
    expect(r.result.current.actions.bulkMergeTarget).toBeNull()
  })
})

// GEO-REGEOCODE-1: bulk "PDOK opnieuw ophalen" — queued + async (202), no
// optimistic row patch and no reconcile against an `updated` list (§13: assert
// the exact request, not just that a callback fired).
describe('useCandidateBulkActions · bulkGeocode (GEO-REGEOCODE-1)', () => {
  it('POSTs /candidates/bulk/geocode with the exact selected candidate_ids', async () => {
    post.mockResolvedValue({ status: 202, data: {} })
    const r = harness([cand({ id: 1 }), cand({ id: 2 })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkGeocode())
    expect(post).toHaveBeenCalledWith('/candidates/bulk/geocode', { candidate_ids: [1, 2] })
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', 'common:geocode.started'))
  })

  it('is a no-op when nothing is selected', () => {
    const r = harness([cand({ id: 1 })])
    act(() => r.result.current.actions.bulkGeocode())
    expect(post).not.toHaveBeenCalled()
  })

  it('shows the generic mutate error toast when the call fails', async () => {
    post.mockRejectedValue(new Error('boom'))
    const r = harness([cand({ id: 1 })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.bulkGeocode())
    await waitFor(() => expect(notify).toHaveBeenCalledWith('error', 'bulk.mutateError'))
  })
})
