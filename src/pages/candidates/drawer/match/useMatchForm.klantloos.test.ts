/**
 * useMatchForm — klant-loos Contractvorm (MATCH-KLANTLOOS-1). A candidate_types
 * row flagged `customer_not_applicable` hides the customer cascade and requires
 * a branch instead; the server rejects customer_id/customer_location_id/
 * customer_department_id/contact_id on such a match and requires branch_id.
 * Asserts the exact POST body (§13: the seam, never just a callback firing) and
 * the switch-away restore, mirroring useMatchForm.contractForm.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useMatchForm } from './useMatchForm'

// Two Contractvorm rows: only 'zzp' is klant-loos — flag-driven, never a
// hardcoded slug check.
const CANDIDATE_TYPES = [
  { value: 'zzp', label: 'ZZP', color: '#6E8FD6', customer_not_applicable: true },
  { value: 'temp_agency', label: 'Uitzend', color: '#9CA3AF', customer_not_applicable: false },
]

vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ candidateTypes: CANDIDATE_TYPES }) }))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('@/pages/vacancies/hooks/useCustomerOptions', () => ({ useCustomerOptions: () => [] }))
vi.mock('@/pages/candidates/hooks/useVacancyOptions', () => ({ useVacancyOptions: () => [] }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: ['Verzorgende IG'], allowFreeEntry: false }) }))
vi.mock('@/lib/useContractTypes', () => ({ useContractTypes: () => ({ types: [], options: [] }) }))
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [{ value: 'branch-1', label: 'Vestiging Noord' }] }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', branch_ids: [] } }) }))
vi.mock('@/pages/candidates/hooks/useRateProposal', () => ({
  useRateProposal: () => ({ proposal: null, deviatesFromProposal: false, confirmDeviation: false, setConfirmDeviation: vi.fn() }),
}))
vi.mock('@/components/actionrules', () => ({ useActionRulePreflight: () => ({ decision: null }) }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const mockCustomer = { id: 'cust-1', name: 'Zorggroep A', branch_id: null, locations: [], contacts: [] }

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  const get = vi.fn((url: string) => {
    if (url.startsWith('/customers/')) return Promise.resolve({ data: { data: mockCustomer } })
    if (url.startsWith('/candidates/')) return Promise.resolve({ data: { data: { branch_id: null, location: null } } })
    return Promise.resolve({ data: { data: [] } })
  })
  return {
    ...actual,
    default: {
      get,
      post: vi.fn(() => Promise.resolve({ data: { data: { id: 'match-1' } } })),
      patch: vi.fn(() => Promise.resolve({ data: { data: {} } })),
    },
    unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
  }
})

import api from '@/lib/api'

const apiPost = api.post as unknown as ReturnType<typeof vi.fn>

function harness() {
  const onClose = vi.fn()
  const onCreated = vi.fn()
  const { result } = renderHook(() => useMatchForm({ candidateId: 'cand-1', onClose, onCreated }))
  return { result, onClose, onCreated }
}

describe('useMatchForm · klant-loos Contractvorm (MATCH-KLANTLOOS-1)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('flags customerNotApplicable when the picked Contractvorm carries the flag', async () => {
    const { result } = harness()
    act(() => { result.current.setContractForm('zzp') })
    await waitFor(() => expect(result.current.customerNotApplicable).toBe(true))
  })

  it('clears a previously staged customer when switching to a klant-loos Contractvorm', async () => {
    const { result } = harness()
    act(() => { result.current.setCustomerId('cust-1') })
    await waitFor(() => expect(result.current.customerId).toBe('cust-1'))

    act(() => { result.current.setContractForm('zzp') })
    await waitFor(() => expect(result.current.customerNotApplicable).toBe(true))
    // The staged customer must not ride along — it is cleared, not just hidden.
    await waitFor(() => expect(result.current.customerId).toBe(''))
  })

  it('blocks submit with an empty branch and no other error when klant-loos', async () => {
    const { result } = harness()
    act(() => { result.current.setFunc('Verzorgende IG') })
    act(() => { result.current.setContractForm('zzp') })
    await waitFor(() => expect(result.current.customerNotApplicable).toBe(true))

    await act(async () => { result.current.handleSubmitClick() })
    expect(apiPost).not.toHaveBeenCalled()
    expect(result.current.errors.branchId).toBe(true)
  })

  it('POSTs branch_id and none of the four customer keys when klant-loos', async () => {
    const { result } = harness()
    act(() => { result.current.setFunc('Verzorgende IG') })
    act(() => { result.current.setContractForm('zzp') })
    await waitFor(() => expect(result.current.customerNotApplicable).toBe(true))
    // Mirrors RelationsSection's onChange: freeze the proposal before setting by hand.
    act(() => { result.current.setBranchDirty(true) })
    act(() => { result.current.setBranchId('branch-1') })
    await waitFor(() => expect(result.current.branchId).toBe('branch-1'))

    await act(async () => { result.current.handleSubmitClick() })
    await waitFor(() => expect(apiPost).toHaveBeenCalled())

    const body = apiPost.mock.calls[0][1]
    expect(body.branch_id).toBe('branch-1')
    expect(body.contract_form).toBe('zzp')
    expect(body).not.toHaveProperty('customer_id')
    expect(body).not.toHaveProperty('customer_location_id')
    expect(body).not.toHaveProperty('customer_department_id')
    expect(body).not.toHaveProperty('contact_id')
  })

  it('unflagged Contractvorm keeps requiring a customer, not a branch', async () => {
    const { result } = harness()
    act(() => { result.current.setFunc('Verzorgende IG') })
    act(() => { result.current.setContractForm('temp_agency') })
    await waitFor(() => expect(result.current.customerNotApplicable).toBe(false))

    // No customer picked — submit must not POST (mirrors the pre-existing guard).
    await act(async () => { result.current.handleSubmitClick() })
    expect(apiPost).not.toHaveBeenCalled()

    act(() => { result.current.setCustomerId('cust-1') })
    await act(async () => { result.current.handleSubmitClick() })
    await waitFor(() => expect(apiPost).toHaveBeenCalled())

    const body = apiPost.mock.calls[0][1]
    expect(body.customer_id).toBe('cust-1')
  })
})
