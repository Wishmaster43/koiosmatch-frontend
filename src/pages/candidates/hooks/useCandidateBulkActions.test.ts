/**
 * useCandidateBulkActions — mirrors the useVacancyBulkActions.test.ts harness
 * (real useState so we can observe optimistic update → reconcile/revert), plus
 * the candidate-only archive-guard flow (§3B): a pre-check blocks the confirm
 * dialog when a live application/match hangs on the selection, and a 409 with
 * the forward-compat `{ live }` payload re-opens the same guard as a safety net.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useState, createElement } from 'react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
// BULK-FILTERSET-1: accepts the optional filterset args so scope tests can drive
// them without disturbing every other test's default (no filters, ids-only).
// r2-react-query-1: wrapped in a real QueryClientProvider now that bulkMutate
// invalidates the stats query — `queryClient` is returned so a test can spy on
// invalidateQueries directly (mirrors useCandidateMutations.test.ts's harness).
function harness(initial: Candidate[], filterArgs: { filterParams?: Record<string, unknown>; filteredTotal?: number; onFilteredMutated?: () => void; funnelTypes?: LookupItem[] } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children)
  const rendered = renderHook(() => {
    const [candidates, setCandidates] = useState<Candidate[]>(initial)
    const [total, setTotal] = useState(initial.length)
    const [selectedIds, setSelectedIds] = useState<Set<Id>>(new Set())
    const actions = useCandidateBulkActions({
      candidates, setCandidates, setTotal, selectedIds, setSelectedIds, notify, t,
      funnelTypes: FUNNEL, candidateTypes: CANDIDATE_TYPES,
      ...filterArgs,
    })
    return { candidates, total, selectedIds, setSelectedIds, actions }
  }, { wrapper })
  return Object.assign(rendered, { queryClient })
}
const rowOf = (r: { result: { current: { candidates: Candidate[] } } }, id: Id) => r.result.current.candidates.find(c => c.id === id)

beforeEach(() => { notify.mockClear(); get.mockReset(); post.mockReset(); del.mockReset(); navigate.mockClear() })

describe('useCandidateBulkActions · bulkSetOwner (bulkMutate optimistic/reconcile)', () => {
  it('patches optimistically, keeps confirmed rows, reverts skipped ones on partial reconcile', async () => {
    post.mockResolvedValue({ data: { updated: [1] } })
    const r = harness([cand({ id: 1, owner: 'Old' }), cand({ id: 2, owner: 'Old' })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkSetOwner({ id: 9, name: 'New Owner' }))
    // Request-asserting (§13): POST /candidates/bulk/owner with the exact ids + owner_id body.
    expect(post).toHaveBeenCalledWith('/candidates/bulk/owner', { candidate_ids: [1, 2], owner_id: 9 })
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
    expect(post).toHaveBeenCalledWith('/candidates/bulk/owner', { candidate_ids: [1], owner_id: 9 })
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', 'bulk.ownerChanged'))
  })

  it('reverts everything and toasts the generic mutate error when the call fails', async () => {
    post.mockRejectedValue(new Error('boom'))
    const r = harness([cand({ id: 1, owner: 'Old' })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.bulkSetOwner({ id: 9, name: 'New' }))
    expect(post).toHaveBeenCalledWith('/candidates/bulk/owner', { candidate_ids: [1], owner_id: 9 })
    await waitFor(() => expect(notify).toHaveBeenCalledWith('error', 'bulk.mutateError'))
    expect(rowOf(r, 1)?.owner).toBe('Old')
  })
})

// BULK-FILTERSET-1: the XOR ids-vs-filters contract on the shared bulkMutate path
// (exercised via bulkSetOwner, one of its generic-mutate callers).
describe('useCandidateBulkActions · filterset bulk scope (XOR ids/filters)', () => {
  it('selected scope (default): the request body carries ids and never a filters key', async () => {
    post.mockResolvedValue({ data: { updated: [1] } })
    const r = harness([cand({ id: 1, owner: 'Old' })], { filterParams: { status: ['available'] }, filteredTotal: 50 })
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.bulkSetOwner({ id: 9, name: 'New Owner' }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    const body = post.mock.calls[0][1]
    expect(body.candidate_ids).toEqual([1])
    expect(body.filters).toBeUndefined()
  })

  it('filtered scope: the request body carries filters and never a candidate_ids key, after the honest confirm', async () => {
    post.mockResolvedValue({ data: { updated: 50 } })
    const onFilteredMutated = vi.fn()
    const r = harness([cand({ id: 1, owner: 'Old' })], { filterParams: { status: ['available'] }, filteredTotal: 50, onFilteredMutated })
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.setBulkScope('filtered'))
    act(() => r.result.current.actions.bulkSetOwner({ id: 9, name: 'New Owner' }))
    // Nothing fires before the recruiter confirms the honest "N results" count.
    expect(post).not.toHaveBeenCalled()
    act(() => r.result.current.actions.dialog.props.onConfirm())
    await waitFor(() => expect(post).toHaveBeenCalled())
    const body = post.mock.calls[0][1]
    expect(body.filters).toEqual({ status: ['available'] })
    expect(body.candidate_ids).toBeUndefined()
    expect(onFilteredMutated).toHaveBeenCalled()
  })

  it('filtered scope with an empty filter set is refused before any call — never a silent "everything"', () => {
    const r = harness([cand({ id: 1, owner: 'Old' })], { filterParams: {}, filteredTotal: 50 })
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.setBulkScope('filtered'))
    act(() => r.result.current.actions.bulkSetOwner({ id: 9, name: 'New Owner' }))
    expect(post).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('error', 'bulk.emptyFilterError')
  })

  it('surfaces the upper-bound error with a readable message instead of a silent truncation', async () => {
    post.mockRejectedValue({ response: { status: 422, data: { code: 'bulk_limit_exceeded', limit: 1000 } } })
    const r = harness([cand({ id: 1, owner: 'Old' })], { filterParams: { status: ['available'] }, filteredTotal: 5000 })
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.setBulkScope('filtered'))
    act(() => r.result.current.actions.bulkSetOwner({ id: 9, name: 'New Owner' }))
    act(() => r.result.current.actions.dialog.props.onConfirm())
    await waitFor(() => expect(notify).toHaveBeenCalledWith('error', 'bulk.limitExceeded'))
  })
})

// r2-react-query-1: the KPI/donut row (useCandidatesData's `['candidates', 'stats', …]`
// query) must never go stale after a bulk field mutation — bulkMutate/bulkMutateFiltered
// invalidate it on success, never on a failed call.
describe('useCandidateBulkActions · stats invalidation after bulkMutate', () => {
  it('invalidates the candidates stats query after a successful selected-scope bulk mutation', async () => {
    post.mockResolvedValue({ data: { updated: [1] } })
    const r = harness([cand({ id: 1, owner: 'Old' })])
    const invalidateSpy = vi.spyOn(r.queryClient, 'invalidateQueries')
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.bulkSetOwner({ id: 9, name: 'New Owner' }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', 'bulk.ownerChanged'))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['candidates', 'stats'] })
  })

  it('does not invalidate the stats query when the bulk mutation fails', async () => {
    post.mockRejectedValue(new Error('boom'))
    const r = harness([cand({ id: 1, owner: 'Old' })])
    const invalidateSpy = vi.spyOn(r.queryClient, 'invalidateQueries')
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.bulkSetOwner({ id: 9, name: 'New' }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('error', 'bulk.mutateError'))
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('invalidates the stats query after a successful filtered-scope bulk mutation too', async () => {
    post.mockResolvedValue({ data: { updated: 50 } })
    const r = harness([cand({ id: 1, owner: 'Old' })], { filterParams: { status: ['available'] }, filteredTotal: 50 })
    const invalidateSpy = vi.spyOn(r.queryClient, 'invalidateQueries')
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.setBulkScope('filtered'))
    act(() => r.result.current.actions.bulkSetOwner({ id: 9, name: 'New Owner' }))
    act(() => r.result.current.actions.dialog.props.onConfirm())
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['candidates', 'stats'] }))
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
