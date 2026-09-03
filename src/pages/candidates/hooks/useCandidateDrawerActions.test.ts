/**
 * useCandidateDrawerActions — regression test for HERAUDIT-2-REST-FE: the
 * single-record archive/mark-deletion guard must judge terminal funnel stages
 * against the LIVE tenant lookup (threaded in via the hook's `funnelTypes`
 * arg), never archiveGuard's own DEFAULT_FUNNEL_TYPES seed fallback — that
 * fallback used to fire because this hook's caller (CandidatesPage) did not
 * thread the lookup through, causing a false-positive archive block for a
 * tenant who renamed/reflagged a terminal stage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCandidateDrawerActions } from './useCandidateDrawerActions'
import type { Candidate } from '@/types/candidate'
import type { LookupItem } from '@/context/LookupsContext'

// Spy on the guard module's two entry points while keeping their real
// behaviour (importActual) — the test asserts the EXACT funnelTypes argument
// each call receives, not just that a modal opened.
vi.mock('../data/archiveGuard', async () => {
  const actual = await vi.importActual<typeof import('../data/archiveGuard')>('../data/archiveGuard')
  return { ...actual, needsLiveCheck: vi.fn(actual.needsLiveCheck), fetchLiveBlockers: vi.fn(actual.fetchLiveBlockers) }
})
import { needsLiveCheck, fetchLiveBlockers } from '../data/archiveGuard'

// Keep the real unwrap (archiveGuard.ts uses it) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})
import api from '@/lib/api'

const get = api.get as unknown as ReturnType<typeof vi.fn>
const notifyMsg = vi.fn()
const t = (key: string) => key

// A tenant lookup where the terminal stage carries a RENAMED, non-seed slug —
// 'voorgesteld' is non-terminal, 'ingevuld' is terminal (is_match). Proves the
// guard resolves off the PASSED lookup, never archiveGuard's DEFAULT seed
// (which knows neither slug).
const TENANT_RENAMED_FUNNEL: LookupItem[] = [
  { value: 'voorgesteld', label: 'Voorgesteld', color: 'slate' },
  { value: 'ingevuld',    label: 'Ingevuld',    color: 'slate', is_match: true },
]

const cand = (overrides: Partial<Candidate> = {}): Candidate => ({
  id: 1, name: 'Test candidate', stage: '', status: 'available',
  pools: [], tags: [], candidateTypes: [], owner: '',
  ...overrides,
} as Candidate)

// Harness mirrors useCandidateBulkActions.test.ts's provider setup — the hook
// pulls in useCandidateRecord (react-query) via useCandidateMutations.
function harness(candidates: Candidate[], funnelTypes?: LookupItem[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children)
  return renderHook(() => useCandidateDrawerActions({
    candidates, setCandidates: () => {}, setTotal: () => {}, notifyMsg, t, funnelTypes,
  }), { wrapper })
}

beforeEach(() => {
  vi.mocked(needsLiveCheck).mockClear()
  vi.mocked(fetchLiveBlockers).mockClear()
  get.mockReset()
  notifyMsg.mockClear()
})

describe('useCandidateDrawerActions · archive guard threads the live tenant funnelTypes', () => {
  it('passes the caller-supplied funnelTypes into both needsLiveCheck and fetchLiveBlockers', async () => {
    get.mockResolvedValue({ data: { data: { applications: [], matches: [] } } })
    const c = cand({ id: 1, stage: 'voorgesteld', status: 'available' })
    const r = harness([c], TENANT_RENAMED_FUNNEL)
    await act(async () => { await r.result.current.archiveOne(1) })
    expect(needsLiveCheck).toHaveBeenCalledWith(c, TENANT_RENAMED_FUNNEL)
    expect(fetchLiveBlockers).toHaveBeenCalledWith(1, TENANT_RENAMED_FUNNEL)
  })

  it('resolves a tenant-renamed terminal stage as non-risky (row pre-filter skips the live-blockers fetch entirely)', async () => {
    const c = cand({ id: 2, stage: 'ingevuld', status: 'available' })
    const r = harness([c], TENANT_RENAMED_FUNNEL)
    await act(async () => { await r.result.current.archiveOne(2) })
    expect(needsLiveCheck).toHaveBeenCalledWith(c, TENANT_RENAMED_FUNNEL)
    // 'ingevuld' is flagged is_match under the tenant lookup → not risky → no fetch.
    expect(fetchLiveBlockers).not.toHaveBeenCalled()
    expect(get).not.toHaveBeenCalled()
  })

  it('falls back to archiveGuard\'s own seed default when no funnelTypes is supplied (pre-load / provider-less caller)', async () => {
    get.mockResolvedValue({ data: { data: { applications: [], matches: [] } } })
    // 'proposal' is a seed (DEFAULT_FUNNEL_TYPES) non-terminal stage.
    const c = cand({ id: 3, stage: 'proposal', status: 'available' })
    const r = harness([c], undefined)
    await act(async () => { await r.result.current.archiveOne(3) })
    expect(needsLiveCheck).toHaveBeenCalledWith(c, undefined)
    expect(fetchLiveBlockers).toHaveBeenCalledWith(3, undefined)
  })
})
