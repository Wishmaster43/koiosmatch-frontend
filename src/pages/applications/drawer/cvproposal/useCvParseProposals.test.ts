/**
 * useCvParseProposals — the SEAM. Every test here asserts the REQUEST (method,
 * route, body), because a proposal flow that compiles but posts to the wrong
 * route is exactly the dead action a callback-only test would have blessed.
 *
 * Covered: the candidate-scoped list route, the application filter (the endpoint
 * is candidate-scoped, so a second application's CV must not leak onto this
 * drill-down), both decision routes posting with NO body, permission gating on
 * candidates.view / candidates.update, and the data-minimisation rule that the
 * candidate record is only fetched when a decision is actually pending.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCvParseProposals } from './useCvParseProposals'

// react-query needs a client in the tree; no JSX here so the file stays plain .ts.
function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

const { apiGet, apiPost } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))
vi.mock('@/lib/api', () => ({
  default: { get: apiGet, post: apiPost },
  unwrap: (res: { data?: unknown }) => (res as { data?: { data?: unknown } })?.data?.data ?? res?.data,
  unwrapList: (res: { data?: { data?: unknown[] } }) => ({
    rows: res?.data?.data ?? [], total: 0, page: 1, lastPage: 1, perPage: 0,
  }),
}))

// Permissions are per-test: the two routes need candidates.view / candidates.update.
let permissions: string[] = ['candidates.view', 'candidates.update']
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ hasPermission: (name: string) => permissions.includes(name) }),
}))

const proposalRow = (over: Record<string, unknown> = {}) => ({
  id: 'p1', application_id: 'a1', status: 'pending', model: 'claude-x',
  created_at: '2026-08-01T09:00:00+02:00',
  fields: { first_name: 'Sanne', last_name: 'de Groot', work_experiences: [], educations: [] },
  ...over,
})

// One place that answers both GETs, so a route typo shows up as an empty result.
const mockApi = (rows: Array<Record<string, unknown>>, candidate: Record<string, unknown> = {}) => {
  apiGet.mockImplementation((url: string) => {
    if (url === '/candidates/c1/cv-parse-proposals') return Promise.resolve({ data: { data: rows } })
    if (url === '/candidates/c1') return Promise.resolve({ data: { data: candidate } })
    return Promise.reject(new Error(`unexpected GET ${url}`))
  })
}

describe('useCvParseProposals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    permissions = ['candidates.view', 'candidates.update']
    apiPost.mockResolvedValue({ data: { data: proposalRow({ status: 'accepted', applied_fields: ['last_name'], skipped_fields: ['first_name'] }) } })
  })

  it('GETs the candidate-scoped proposal list', async () => {
    mockApi([proposalRow()])
    const { result } = renderHook(() => useCvParseProposals('c1', 'a1'), { wrapper })

    await waitFor(() => expect(result.current.proposals).toHaveLength(1))
    expect(apiGet).toHaveBeenCalledWith('/candidates/c1/cv-parse-proposals', expect.objectContaining({ signal: expect.anything() }))
  })

  // The route is candidate-scoped: a candidate who applied twice has a proposal
  // per parsed CV, and showing the other application's CV here would be wrong data.
  it('keeps only the proposals belonging to THIS application', async () => {
    mockApi([proposalRow({ id: 'p1', application_id: 'a1' }), proposalRow({ id: 'p2', application_id: 'a2' })])
    const { result } = renderHook(() => useCvParseProposals('c1', 'a1'), { wrapper })

    await waitFor(() => expect(result.current.proposals).toHaveLength(1))
    expect(result.current.proposals[0].id).toBe('p1')
  })

  it('POSTs the accept route with no body at all', async () => {
    mockApi([proposalRow()], { first_name: 'Sanne' })
    const { result } = renderHook(() => useCvParseProposals('c1', 'a1'), { wrapper })
    await waitFor(() => expect(result.current.proposals).toHaveLength(1))

    await act(async () => { await result.current.decide('p1', 'accept') })

    // Exactly one argument — the applier owns the merge rule, the client sends no
    // field selection (there is no per-field accept route on the backend).
    expect(apiPost).toHaveBeenCalledTimes(1)
    expect(apiPost).toHaveBeenCalledWith('/candidates/c1/cv-parse-proposals/p1/accept')
  })

  it('POSTs the reject route with no body at all', async () => {
    mockApi([proposalRow()], { first_name: 'Sanne' })
    const { result } = renderHook(() => useCvParseProposals('c1', 'a1'), { wrapper })
    await waitFor(() => expect(result.current.proposals).toHaveLength(1))

    await act(async () => { await result.current.decide('p1', 'reject') })

    expect(apiPost).toHaveBeenCalledTimes(1)
    expect(apiPost).toHaveBeenCalledWith('/candidates/c1/cv-parse-proposals/p1/reject')
  })

  it('exposes the accept response summary (applied/skipped) to the caller', async () => {
    mockApi([proposalRow()], { first_name: 'Sanne' })
    const { result } = renderHook(() => useCvParseProposals('c1', 'a1'), { wrapper })
    await waitFor(() => expect(result.current.proposals).toHaveLength(1))

    await act(async () => { await result.current.decide('p1', 'accept') })

    await waitFor(() => expect(result.current.lastDecided?.appliedFields).toEqual(['last_name']))
    expect(result.current.lastDecided?.skippedFields).toEqual(['first_name'])
  })

  it('rejects the promise when the decision fails, so the caller can report it', async () => {
    mockApi([proposalRow()], { first_name: 'Sanne' })
    apiPost.mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useCvParseProposals('c1', 'a1'), { wrapper })
    await waitFor(() => expect(result.current.proposals).toHaveLength(1))

    await expect(result.current.decide('p1', 'accept')).rejects.toThrow('boom')
    expect(result.current.lastDecided).toBeNull()
  })

  // Data minimisation (§8): the candidate's full record is personal data — only
  // fetched when a decision is actually pending and a diff has to be shown.
  it('fetches the candidate record only when a proposal is still pending', async () => {
    mockApi([proposalRow({ status: 'accepted' })], { first_name: 'Sanne' })
    const { result } = renderHook(() => useCvParseProposals('c1', 'a1'), { wrapper })
    await waitFor(() => expect(result.current.proposals).toHaveLength(1))

    expect(apiGet).not.toHaveBeenCalledWith('/candidates/c1', expect.anything())
    expect(result.current.currentCandidate).toBeNull()
  })

  it('fetches the candidate record for the diff once a proposal is pending', async () => {
    mockApi([proposalRow()], { first_name: 'Sanne' })
    const { result } = renderHook(() => useCvParseProposals('c1', 'a1'), { wrapper })

    await waitFor(() => expect(result.current.currentCandidate).toEqual({ first_name: 'Sanne' }))
    expect(apiGet).toHaveBeenCalledWith('/candidates/c1', expect.objectContaining({ signal: expect.anything() }))
  })

  it('never calls the API without candidates.view', async () => {
    permissions = []
    mockApi([proposalRow()])
    const { result } = renderHook(() => useCvParseProposals('c1', 'a1'), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(apiGet).not.toHaveBeenCalled()
    expect(result.current.proposals).toEqual([])
  })

  it('reports canDecide=false without candidates.update', async () => {
    permissions = ['candidates.view']
    mockApi([proposalRow()])
    const { result } = renderHook(() => useCvParseProposals('c1', 'a1'), { wrapper })

    await waitFor(() => expect(result.current.proposals).toHaveLength(1))
    expect(result.current.canDecide).toBe(false)
  })

  it('fetches nothing without a linked candidate', async () => {
    mockApi([proposalRow()])
    renderHook(() => useCvParseProposals(null, 'a1'), { wrapper })

    await waitFor(() => expect(apiGet).not.toHaveBeenCalled())
  })
})
