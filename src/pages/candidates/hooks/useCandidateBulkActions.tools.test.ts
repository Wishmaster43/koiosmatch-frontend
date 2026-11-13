/** useCandidateBulkActions · merge, geocode and backoffice coupling (split from useCandidateBulkActions.test.ts; same harness and mocks). */
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
      candidates, setCandidates, setTotal, selectedIds, setSelectedIds, notify, t, i18n: { exists: () => false },
      funnelTypes: FUNNEL, candidateTypes: CANDIDATE_TYPES,
      ...filterArgs,
    })
    return { candidates, total, selectedIds, setSelectedIds, actions }
  }, { wrapper })
  return Object.assign(rendered, { queryClient })
}

beforeEach(() => { notify.mockClear(); get.mockReset(); post.mockReset(); del.mockReset(); navigate.mockClear() })

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

// SYNC-BULK-1: bulk backoffice coupling — the 3rd of the three linking paths
// (§3B: manual/bulk/workflow). Shares the ONE generic POST /sync/{entity}/bulk
// endpoint (BackofficeSyncController::bulk) the per-record BackofficeLinksTab
// already uses. Queued + async — no optimistic row patch — and the { queued,
// skipped } response must produce an honest partial-result toast, never a bare
// "success" that hides a matrix-blocked or unknown id (§13: assert the exact
// request, not just that a callback fired).
describe('useCandidateBulkActions · bulkCoupleBackoffice (SYNC-BULK-1)', () => {
  it('POSTs /sync/candidates/bulk with the exact ids + system, reports the queued count, and clears the selection', async () => {
    post.mockResolvedValue({ data: { queued: [1, 2], skipped: [] } })
    const r = harness([cand({ id: 1 }), cand({ id: 2 })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkCoupleBackoffice('helloflex'))
    expect(post).toHaveBeenCalledWith('/sync/candidates/bulk', { ids: [1, 2], system: 'helloflex' })
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', 'bulk.coupleQueued'))
    expect(r.result.current.selectedIds.size).toBe(0)
  })

  it('reports a partial result honestly when the server skips some ids', async () => {
    post.mockResolvedValue({ data: { queued: [1], skipped: [2] } })
    const r = harness([cand({ id: 1 }), cand({ id: 2 })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkCoupleBackoffice('shiftmanager'))
    expect(post).toHaveBeenCalledWith('/sync/candidates/bulk', { ids: [1, 2], system: 'shiftmanager' })
    await waitFor(() => expect(notify).toHaveBeenCalledWith('warning', 'bulk.coupleQueuedPartial'))
    expect(notify).not.toHaveBeenCalledWith('success', expect.anything())
  })

  it('is a no-op when nothing is selected', () => {
    const r = harness([cand({ id: 1 })])
    act(() => r.result.current.actions.bulkCoupleBackoffice('helloflex'))
    expect(post).not.toHaveBeenCalled()
  })

  it('treats a 404/503 as "not available yet", never a hard error', async () => {
    post.mockRejectedValue({ response: { status: 503 } })
    const r = harness([cand({ id: 1 })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.bulkCoupleBackoffice('helloflex'))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('info', 'bulk.coupleUnavailable'))
  })

  it('shows the generic mutate error toast on any other failure', async () => {
    post.mockRejectedValue({ response: { status: 500 } })
    const r = harness([cand({ id: 1 })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.bulkCoupleBackoffice('helloflex'))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('error', 'bulk.mutateError'))
  })
})
