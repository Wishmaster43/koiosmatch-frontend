/**
 * useCandidateStageBulk — the funnel/phase/status cluster extracted out of
 * useCandidateBulkActions (§3 size split). The harness mirrors the PARENT
 * hook's own `bulkMutate`/`notifyOutcome`/`useConfirm` wiring (real
 * implementations, not stubs) so the optimistic-patch/reconcile/revert and
 * confirm-dialog contracts are exercised exactly as production wires them —
 * moved here verbatim from useCandidateBulkActions.test.ts (§13: verplaats
 * tests, don't just re-test through the re-export).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { useConfirm } from '@/hooks/useConfirm'
import { useCandidateStageBulk } from './useCandidateStageBulk'
import type { BulkMutateArgs } from './useCandidateBulkActions'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'
import type { LookupItem } from '@/context/LookupsContext'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})
import api from '@/lib/api'

const post = api.post as unknown as ReturnType<typeof vi.fn>
const notify = vi.fn()
const t = ((k: string) => k) as unknown as import('i18next').TFunction

const FUNNEL: LookupItem[] = [
  { value: 'applied',  label: 'Applied',  color: 'slate' },
  { value: 'proposal', label: 'Proposed', color: 'slate' },
]

const cand = (overrides: Partial<Candidate> = {}): Candidate => ({
  id: 1, name: 'Test candidate', stage: '', status: 'available',
  pools: [], tags: [], candidateTypes: [], owner: '',
  ...overrides,
} as Candidate)

// Harness: real candidates state + a real bulkMutate/notifyOutcome/useConfirm,
// mirroring exactly what useCandidateBulkActions passes into this hook — so
// this test exercises the same optimistic-update/reconcile/confirm contract
// the real app runs, not a mocked stand-in.
function harness(initial: Candidate[]) {
  return renderHook(() => {
    const [candidates, setCandidates] = useState<Candidate[]>(initial)
    const [selectedIds, setSelectedIds] = useState<Set<Id>>(new Set())
    const { confirm, dialog } = useConfirm()

    const subsetOf = <T,>(obj: T, keys: Array<keyof T>): Partial<T> =>
      keys.reduce((a, k) => { a[k] = obj[k]; return a }, {} as Partial<T>)

    const notifyOutcome = (successKey: string, params: Record<string, unknown>, updated: number, total: number) => {
      if (total > 0 && updated < total) {
        notify('warning', t('bulk.partialResult', { ...params, updated, total, skipped: total - updated }))
      } else {
        notify('success', t(successKey, { ...params, count: updated }))
      }
    }

    const bulkMutate = ({ url, body, patch, keys, onSuccess }: BulkMutateArgs) => {
      const ids = [...selectedIds]
      if (!ids.length) return
      const snap = new Map(candidates.filter(c => ids.includes(c.id)).map(c => [c.id, subsetOf(c, keys)]))
      setCandidates(prev => prev.map(c => ids.includes(c.id) ? { ...c, ...patch } : c))
      api.post(url, { candidate_ids: ids, ...body })
        .then((res) => {
          const updated = Array.isArray(res.data?.updated) ? new Set(res.data.updated) : null
          if (updated) setCandidates(prev => prev.map(c => (ids.includes(c.id) && !updated.has(c.id)) ? { ...c, ...snap.get(c.id) } : c))
          onSuccess(updated ? updated.size : ids.length, ids.length, Array.isArray(res.data?.skipped) ? res.data.skipped : undefined)
        })
        .catch(() => {
          setCandidates(prev => prev.map(c => ids.includes(c.id) ? { ...c, ...snap.get(c.id) } : c))
          notify('error', t('bulk.mutateError'))
        })
      setSelectedIds(new Set())
    }

    const actions = useCandidateStageBulk({ selectedIds, notify, t, funnelTypes: FUNNEL, confirm, bulkMutate, notifyOutcome })
    return { candidates, setSelectedIds, actions, dialog }
  })
}

beforeEach(() => { notify.mockClear(); post.mockReset() })

// BULK-FUNNEL-SOLE-1/42: bulkSetStage drives the bulk funnel-stage action
// (candidates/bulk/funnel-stage), which the BE resolves against each candidate's ONE-
// AND-ONLY live application (no vacancy scope — a candidate with 0 or >1 live
// applications is `skipped`, never silently dropped from the count or guessed at).
describe('useCandidateStageBulk · bulkSetStage (funnel-stage, BULK-FUNNEL-SOLE-1/42)', () => {
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

describe('useCandidateStageBulk · bulkConvertPhase', () => {
  it('warns (not success) when fewer candidates were updated than selected', async () => {
    post.mockResolvedValue({ data: { updated: [1] } })
    const r = harness([cand({ id: 1 }), cand({ id: 2 })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkConvertPhase('candidate'))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('warning', expect.any(String)))
  })

  // BULK-SKIP-REASONS-1: /candidates/bulk/phase now also returns skipped as
  // [{id, reason}] — the toast shows the reason breakdown instead of a bare count.
  it('warns with the reasoned breakdown when skipped carries [{id, reason}]', async () => {
    post.mockResolvedValue({ data: { updated: [1], skipped: [{ id: 2, reason: 'missing_required_field' }] } })
    const r = harness([cand({ id: 1 }), cand({ id: 2 })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkConvertPhase('candidate'))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('warning', 'bulk.convertResultReasoned'))
  })
})

// AXIS-MATRIX-2 N2 (CMFE audit R1): bulkSetStatus is the ONE bulk mutation with a
// real action-rules catalog entry (candidate.status_set) — a preflight summary runs
// BEFORE the mutate, so a block is surfaced up front (the shared ConfirmDialog)
// instead of only in the after-the-fact partial-result toast. `post` stands in for
// BOTH endpoints here (preflight-bulk + the real status mutate), routed by URL.
describe('useCandidateStageBulk · bulkSetStatus (AXIS-MATRIX-2 N2 bulk preflight)', () => {
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
    // No confirm staged — the shared ConfirmDialog never opens.
    expect(r.result.current.dialog.props.open).toBe(false)
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
    expect(r.result.current.dialog.props.message).toBe('bulk.statusBlockedConfirmSample')
    act(() => r.result.current.dialog.props.onConfirm())
    await waitFor(() => expect(post).toHaveBeenCalledWith('/candidates/bulk/status', { candidate_ids: [1, 2, 3], status: 'placed' }))
  })

  it('falls back to the plain blocked confirm when the preflight has no sample names', async () => {
    post.mockImplementation((url: string) => {
      if (url === '/action-rules/preflight-bulk') return Promise.resolve({
        data: { total: 3, allowed: 2, warned: 0, blocked: 1, not_found: 0,
          breakdown: [{ condition: 'archived', popup_code: 'P4', effect: 'block', count: 1, sample_names: [] }] },
      })
      return Promise.reject(new Error('unexpected'))
    })
    const r = harness([cand({ id: 1 }), cand({ id: 2 }), cand({ id: 3 })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2, 3])))
    await act(async () => { r.result.current.actions.bulkSetStatus('placed', 'Geplaatst') })
    expect(r.result.current.dialog.props.message).toBe('bulk.statusBlockedConfirm')
  })

  it('never mutates when the recruiter cancels the confirm', async () => {
    post.mockImplementation((url: string) => {
      if (url === '/action-rules/preflight-bulk') return Promise.resolve({
        data: { total: 2, allowed: 1, warned: 0, blocked: 1, not_found: 0,
          breakdown: [{ condition: 'archived', popup_code: 'P4', effect: 'block', count: 1, sample_names: [] }] },
      })
      return Promise.reject(new Error('unexpected'))
    })
    const r = harness([cand({ id: 1 }), cand({ id: 2 })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    await act(async () => { r.result.current.actions.bulkSetStatus('placed', 'Geplaatst') })
    act(() => r.result.current.dialog.props.onCancel())
    expect(post).not.toHaveBeenCalledWith('/candidates/bulk/status', expect.anything())
  })

  it('warns (no confirm dialog, no mutate) when every selected candidate is blocked', async () => {
    post.mockImplementation((url: string) => {
      if (url === '/action-rules/preflight-bulk') return Promise.resolve({
        data: { total: 1, allowed: 0, warned: 0, blocked: 1, not_found: 0,
          breakdown: [{ condition: 'archived', popup_code: 'P4', effect: 'block', count: 1, sample_names: [] }] },
      })
      return Promise.reject(new Error('unexpected'))
    })
    const r = harness([cand({ id: 1 })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    await act(async () => { r.result.current.actions.bulkSetStatus('placed', 'Geplaatst') })
    await waitFor(() => expect(notify).toHaveBeenCalledWith('warning', 'bulk.statusAllBlocked'))
    expect(r.result.current.dialog.props.open).toBe(false)
    expect(post).not.toHaveBeenCalledWith('/candidates/bulk/status', expect.anything())
  })

  it('is a courtesy preview, not a gate — a failed preflight fetch still lets the real mutate run', async () => {
    post.mockImplementation((url: string) => {
      if (url === '/action-rules/preflight-bulk') return Promise.reject(new Error('network hiccup'))
      if (url === '/candidates/bulk/status') return Promise.resolve({ data: { updated: [1] } })
      return Promise.reject(new Error('unexpected'))
    })
    const r = harness([cand({ id: 1 })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    await act(async () => { r.result.current.actions.bulkSetStatus('placed', 'Geplaatst') })
    await waitFor(() => expect(post).toHaveBeenCalledWith('/candidates/bulk/status', { candidate_ids: [1], status: 'placed' }))
  })
})
