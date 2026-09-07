/**
 * useMatchForm — candidate-picker data-minimization regression coverage (PRIV-1/
 * PRIV-2). The picker used to eagerly load 200 full candidate records on mount
 * with no search term; it must now stay silent until the recruiter types a real
 * search term, request only a small page, and never let a superseded (slower)
 * response win over a later, faster one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useMatchForm } from './useMatchForm'

vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ candidateTypes: [] }) }))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('@/hooks/useCustomerOptions', () => ({ useCustomerOptions: () => [] }))
vi.mock('@/pages/candidates/hooks/useVacancyOptions', () => ({ useVacancyOptions: () => [] }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: [], allowFreeEntry: false }) }))
vi.mock('@/lib/useContractTypes', () => ({ useContractTypes: () => ({ types: [], options: [] }) }))
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [] }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', branch_ids: [] } }) }))
vi.mock('@/pages/candidates/hooks/useRateProposal', () => ({
  useRateProposal: () => ({ proposal: null, deviatesFromProposal: false, confirmDeviation: false, setConfirmDeviation: vi.fn() }),
}))
vi.mock('@/components/actionrules', () => ({ useActionRulePreflight: () => ({ decision: null }) }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// GET /candidates → tracked so tests can assert request shape and ordering.
// Declared via vi.hoisted so the mock factory below (hoisted to the top of the
// file by vitest) can reference it without a "used before initialization" error.
const { getCandidates } = vi.hoisted(() => ({
  getCandidates: vi.fn((url: string, opts?: { params?: Record<string, unknown>; signal?: AbortSignal }) => {
    void opts
    if (url === '/candidates') return Promise.resolve({ data: { data: [{ id: 'c1', name: 'Jan Jansen' }] } })
    return Promise.resolve({ data: { data: [] } })
  }),
}))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return {
    ...actual,
    default: {
      get: getCandidates,
      post: vi.fn(() => Promise.resolve({ data: { data: { id: 'match-1' } } })),
      patch: vi.fn(() => Promise.resolve({ data: { data: {} } })),
    },
    unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
  }
})

// No candidateId fixed — the picker only renders/fetches in this mode.
function harness() {
  const onClose = vi.fn()
  const onCreated = vi.fn()
  return renderHook(() => useMatchForm({ onClose, onCreated }))
}

// The hook's other lookups (cao/contact-functions/match-statuses/settings) share
// this same mocked api.get — every assertion below filters to '/candidates' calls only.
const candidateCalls = () => getCandidates.mock.calls.filter(([url]) => url === '/candidates')

describe('useMatchForm · candidate picker search (PRIV-1/PRIV-2)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('never requests /candidates while the search term is below the minimum length', async () => {
    const { result } = harness()
    expect(candidateCalls()).toHaveLength(0)
    act(() => { result.current.setCandidateSearch('j') })
    await new Promise(r => setTimeout(r, 10))
    expect(candidateCalls()).toHaveLength(0)
  })

  it('requests /candidates with the search term and a small per_page once ≥ the minimum length', async () => {
    const { result } = harness()
    act(() => { result.current.setCandidateSearch('jan') })
    await waitFor(() => expect(candidateCalls().length).toBeGreaterThan(0))
    const callOpts = candidateCalls()[0]?.[1]
    expect(callOpts?.params).toEqual(expect.objectContaining({ search: 'jan', light: 1 }))
    expect((callOpts?.params?.per_page as number) ?? Infinity).toBeLessThanOrEqual(25)
    await waitFor(() => expect(result.current.candidateOptions).toEqual([{ id: 'c1', name: 'Jan Jansen' }]))
  })

  it('a superseded (stale) response never overwrites a later search\'s result (alive guard)', async () => {
    let resolveFirst: (v: { data: { data: Array<{ id: string; name: string }> } }) => void = () => {}
    let candidateCallCount = 0
    getCandidates.mockImplementation((url: string) => {
      if (url !== '/candidates') return Promise.resolve({ data: { data: [] } })
      candidateCallCount += 1
      // First /candidates call stays pending until resolveFirst() is invoked below;
      // every subsequent one (the fresher search) resolves immediately.
      if (candidateCallCount === 1) return new Promise(res => { resolveFirst = res })
      return Promise.resolve({ data: { data: [{ id: 'c1', name: 'Jan Jansen' }] } })
    })
    const { result } = harness()

    act(() => { result.current.setCandidateSearch('aa') })
    await waitFor(() => expect(candidateCalls().length).toBe(1))

    // Second search fires before the first ever resolves.
    act(() => { result.current.setCandidateSearch('bb') })
    await waitFor(() => expect(candidateCalls().length).toBe(2))

    // The slow first response resolves last — it must never win.
    resolveFirst({ data: { data: [{ id: 'stale', name: 'Stale Result' }] } })
    await waitFor(() => expect(result.current.candidateOptions).toEqual([{ id: 'c1', name: 'Jan Jansen' }]))
  })

  // MATCH-PICK-LABEL-1: CreatableSelect.pick() resets its query to '' right after a
  // pick, which (via the search debounce) clears the too-short-query search below the
  // minimum length — the picked candidate's own option must still resolve afterwards,
  // never fall back to rendering the raw candidate id.
  it('pick a candidate → the trigger still shows the name', async () => {
    const { result } = harness()
    act(() => { result.current.setCandidateSearch('jan') })
    await waitFor(() => expect(result.current.candidateOptions).toEqual([{ id: 'c1', name: 'Jan Jansen' }]))

    // Recruiter picks the candidate (CreatableSelect.onChange), then its own
    // debounce fires onSearch('') as the query resets — mirrored here directly.
    act(() => { result.current.setPickedCandidateId('c1') })
    act(() => { result.current.setCandidateSearch('') })
    await new Promise(r => setTimeout(r, 10))

    expect(result.current.pickedCandidateId).toBe('c1')
    expect(result.current.candidateOptions.find(c => String(c.id) === 'c1')?.name).toBe('Jan Jansen')
  })
})
