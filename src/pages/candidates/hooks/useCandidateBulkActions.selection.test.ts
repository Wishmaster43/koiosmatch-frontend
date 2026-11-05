/** useCandidateBulkActions · tags, stage, deep-link, partial archive and note/phase/consent (split from useCandidateBulkActions.test.ts; same harness and mocks). */
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

// BULK-FUNNEL-SOLE-1/42: bulkSetStage's detailed behaviour (the funnel-stage
// route, the reasoned-skip breakdown) moved to useCandidateStageBulk.test.ts
// (§3 size split) — this is a thin smoke test confirming the re-export still
// reaches the real endpoint through the parent hook's public API.
describe('useCandidateBulkActions · bulkSetStage (re-export smoke test)', () => {
  it('still POSTs the funnel-stage route through the parent hook', async () => {
    post.mockResolvedValue({ data: { updated: [1] } })
    const r = harness([cand({ id: 1, stage: 'applied' })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.bulkSetStage('proposal'))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/candidates/bulk/funnel-stage', { candidate_ids: [1], funnel_type: 'proposal' }))
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

  // bulkConvertPhase's detailed behaviour (the reasoned-skip breakdown) moved
  // to useCandidateStageBulk.test.ts (§3 size split) — smoke-test the re-export.
  it('bulkConvertPhase still POSTs the phase route through the parent hook', async () => {
    post.mockResolvedValue({ data: { updated: [1] } })
    const r = harness([cand({ id: 1 }), cand({ id: 2 })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkConvertPhase('candidate'))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/candidates/bulk/phase', { candidate_ids: [1, 2], phase: 'candidate' }))
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
