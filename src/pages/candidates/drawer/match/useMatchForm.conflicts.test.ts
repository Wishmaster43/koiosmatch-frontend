/**
 * useMatchForm · duplicate + overlap preflight (points 5/6, Danny's ten-point
 * round: 1.10/1.11). Mocked GET /matches?candidate_id= drives both warnings —
 * client-side over real (mocked) data, exactly like the production hook reads
 * it. Both are WARN-only: this file's whole point is proving neither one blocks
 * `handleSubmitClick` (house rule, never block on a create).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useMatchForm } from './useMatchForm'

const mockCustomer = { id: 'cust-1', name: 'Zorggroep A', locations: [], contacts: [] }

// The candidate's own existing matches (GET /matches?candidate_id=cand-1):
//  - match-dup: same customer (cust-1) as the draft picks below — point 5.
//  - match-overlap: a DIFFERENT customer (cust-2) but an overlapping ACTIVE
//    period — point 6 is candidate-WIDE, not scoped to one customer.
//  - match-closed: overlaps too, but its status is CLOSED — must never warn.
const existingMatches = [
  {
    id: 'match-dup', customer_id: 'cust-1', customer_location_id: null, customer_department_id: null,
    status: 'open', start_date: null, end_date: null,
    vacancy: { title: 'Eerdere Vacature' }, client_name: 'Zorggroep A',
  },
  {
    id: 'match-overlap', customer_id: 'cust-2', customer_location_id: null, customer_department_id: null,
    status: 'open', start_date: '2026-01-01', end_date: '2026-06-30',
    vacancy: { title: 'Andere Klant Vacature' }, client_name: 'Andere Zorg BV',
  },
  {
    id: 'match-closed', customer_id: 'cust-3', customer_location_id: null, customer_department_id: null,
    status: 'closed', start_date: '2026-01-01', end_date: '2026-12-31',
    vacancy: { title: 'Afgeronde Vacature' }, client_name: 'Derde Klant',
  },
]

vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('@/pages/vacancies/hooks/useCustomerOptions', () => ({ useCustomerOptions: () => [] }))
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

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  const get = vi.fn((url: string) => {
    if (url.startsWith('/customers/')) return Promise.resolve({ data: { data: mockCustomer } })
    if (url === '/candidates/cand-1') return Promise.resolve({ data: { data: { branch_id: null, location: null } } })
    // The candidate's own matches list (useExistingCandidateMatches) — the ONLY
    // caller of GET /matches (bare, no id segment) in this hook.
    if (url === '/matches') return Promise.resolve({ data: { data: existingMatches } })
    return Promise.resolve({ data: { data: [] } })
  })
  return {
    ...actual,
    default: { get, post: vi.fn(() => Promise.resolve({ data: { data: { id: 'match-1' } } })), patch: vi.fn(() => Promise.resolve({ data: { data: {} } })) },
    unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
    unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
  }
})

import api from '@/lib/api'
const apiGet = api.get as unknown as ReturnType<typeof vi.fn>
const apiPost = api.post as unknown as ReturnType<typeof vi.fn>

describe('useMatchForm · duplicate + overlap preflight (points 5/6)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches the candidate\'s own matches via the real GET /matches?candidate_id= endpoint', async () => {
    renderHook(() => useMatchForm({ candidateId: 'cand-1', onClose: vi.fn(), onCreated: vi.fn() }))
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/matches', { params: { candidate_id: 'cand-1', per_page: 100 } }))
  })

  it('flags a duplicate once candidate + the SAME customer are chosen (point 5), from mocked existing-match data', async () => {
    const { result } = renderHook(() => useMatchForm({ candidateId: 'cand-1', onClose: vi.fn(), onCreated: vi.fn() }))
    expect(result.current.duplicateMatch).toBeNull() // no customer picked yet
    act(() => { result.current.setCustomerId('cust-1') })
    await waitFor(() => expect(result.current.duplicateMatch?.id).toBe('match-dup'))
  })

  it('never flags a duplicate for a DIFFERENT customer', async () => {
    const { result } = renderHook(() => useMatchForm({ candidateId: 'cand-1', onClose: vi.fn(), onCreated: vi.fn() }))
    act(() => { result.current.setCustomerId('cust-9') })
    await waitFor(() => expect(result.current.customerId).toBe('cust-9'))
    expect(result.current.duplicateMatch).toBeNull()
  })

  it('flags an overlapping ACTIVE match candidate-wide (point 6) — even at a DIFFERENT customer', async () => {
    const { result } = renderHook(() => useMatchForm({ candidateId: 'cand-1', onClose: vi.fn(), onCreated: vi.fn() }))
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/matches', expect.anything()))
    act(() => { result.current.setStartDate('2026-05-01') })
    act(() => { result.current.setEndDate('2026-08-01') })
    await waitFor(() => expect(result.current.overlappingMatches.map(m => m.id)).toContain('match-overlap'))
    // The CLOSED match overlaps the SAME period but must never be flagged.
    expect(result.current.overlappingMatches.map(m => m.id)).not.toContain('match-closed')
  })

  it('never blocks submit — both warnings are non-blocking (house rule: warn, never block)', async () => {
    const { result } = renderHook(() => useMatchForm({ candidateId: 'cand-1', onClose: vi.fn(), onCreated: vi.fn() }))
    act(() => { result.current.setCustomerId('cust-1') }) // triggers the duplicate warning
    await waitFor(() => expect(result.current.duplicateMatch).not.toBeNull())
    act(() => { result.current.setStartDate('2026-05-01'); result.current.setEndDate('2026-08-01') })
    await waitFor(() => expect(result.current.overlappingMatches.length).toBeGreaterThan(0))

    act(() => { result.current.setFunc('Verzorgende IG') })
    act(() => { result.current.handleSubmitClick() })
    // The create still goes through despite BOTH warnings being active.
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/matches', expect.objectContaining({ customer_id: 'cust-1' })))
  })
})
