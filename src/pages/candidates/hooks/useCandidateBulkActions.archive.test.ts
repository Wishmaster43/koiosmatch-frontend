/** useCandidateBulkActions · archive guard and status re-export smoke (split from useCandidateBulkActions.test.ts; same harness and mocks). */
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

// HERAUDIT-2-REST-FE: a tenant-renamed terminal slug the SEED (DEFAULT_FUNNEL_TYPES)
// does not know — proves fetchLiveBlockers' full per-application check receives the
// SAME tenant funnelTypes as the row-level pre-filter, not archiveGuard's own seed.
const TENANT_RENAMED_FUNNEL: LookupItem[] = [
  { value: 'voorgesteld', label: 'Voorgesteld', color: 'slate' },
  { value: 'ingevuld',    label: 'Ingevuld',    color: 'slate', is_match: true },
]

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

beforeEach(() => { notify.mockClear(); get.mockReset(); post.mockReset(); del.mockReset(); navigate.mockClear() })

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

  // HERAUDIT-2-REST-FE: fetchLiveBlockers' full per-application check used to fall
  // back to the DEFAULT_FUNNEL_TYPES seed even though the row-level pre-filter just
  // above already received the live tenant lookup — a tenant-renamed terminal phase
  // then read as "still live" (false-positive block). This proves the fix: the same
  // funnelTypes now reaches BOTH the pre-filter and the full check.
  it('resolves a tenant-renamed terminal application phase as NOT a blocker (fetchLiveBlockers now shares the pre-filter\'s tenant funnelTypes)', async () => {
    get.mockImplementation((url: string) => {
      if (url === '/candidates/1') return Promise.resolve({ data: { data: {
        applications: [{ id: 'a1', vacancyTitle: 'X', stageLabel: 'Y', stageColor: null }], matches: [],
      } } })
      // The nested application's authoritative phase uses the TENANT's renamed
      // terminal slug — DEFAULT_FUNNEL_TYPES (the seed) does not know it.
      if (url === '/applications/a1') return Promise.resolve({ data: { data: { phase_key: 'ingevuld' } } })
      return Promise.reject(new Error('unexpected ' + url))
    })
    post.mockResolvedValue({ data: { archived: [1] } })
    const r = harness([cand({ id: 1, stage: 'voorgesteld', status: 'available' })], { funnelTypes: TENANT_RENAMED_FUNNEL })
    act(() => r.result.current.setSelectedIds(new Set([1])))
    await act(async () => { await r.result.current.actions.bulkArchive() })
    expect(get).toHaveBeenCalledWith('/candidates/1')
    expect(get).toHaveBeenCalledWith('/applications/a1')
    // No blocker found under the tenant lookup → the guard modal never opens.
    expect(r.result.current.actions.bulkArchiveGuard).toBeNull()
    act(() => r.result.current.actions.dialog.props.onConfirm())
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', expect.any(String)))
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

// AXIS-MATRIX-2 N2 (CMFE audit R1): bulkSetStatus's detailed preflight/confirm
// behaviour moved to useCandidateStageBulk.test.ts (§3 size split) — this is a
// thin smoke test confirming the re-export still runs the real preflight +
// mutate through the parent hook's public API.
describe('useCandidateBulkActions · bulkSetStatus (re-export smoke test)', () => {
  it('still runs the preflight + mutate through the parent hook when nothing is blocked', async () => {
    post.mockImplementation((url: string) => {
      if (url === '/action-rules/preflight-bulk') return Promise.resolve({ data: { total: 1, allowed: 1, warned: 0, blocked: 0, not_found: 0, breakdown: [] } })
      if (url === '/candidates/bulk/status') return Promise.resolve({ data: { updated: [1] } })
      return Promise.reject(new Error('unexpected ' + url))
    })
    const r = harness([cand({ id: 1, status: 'available' })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    await act(async () => { r.result.current.actions.bulkSetStatus('placed', 'Geplaatst') })
    await waitFor(() => expect(post).toHaveBeenCalledWith('/candidates/bulk/status', { candidate_ids: [1], status: 'placed' }))
  })
})
