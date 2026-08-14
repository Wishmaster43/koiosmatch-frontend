/**
 * useMatchForm · initial scope seed (point 1, Danny's ten-point round) — a
 * "+ Match" opened from a customer/location/department drill-down seeds the
 * Relaties cascade's INITIAL state via initialCustomerId/initialCustomerLocationId/
 * initialCustomerDepartmentId. This must be a PREFILL, never a lock: the one risk
 * (skipCascadeResetRef) is that the mount-time run of the "picking a new customer
 * clears location/department" effect would otherwise immediately wipe the seeded
 * location/department the instant customerId itself is set from the prop — this
 * file proves that does NOT happen, and that picking a DIFFERENT customer by hand
 * afterwards still clears them normally (the guard is one-shot, not permanent).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useMatchForm } from './useMatchForm'

const mockCustomer = {
  id: 'cust-1', name: 'Zorggroep A',
  locations: [{ id: 'loc-1', name: 'Locatie Noord', departments: [{ id: 'dep-1', name: 'Afdeling A' }] }],
  contacts: [],
}

vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ candidateTypes: [] }) }))
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
    if (url.startsWith('/candidates/')) return Promise.resolve({ data: { data: { branch_id: null, location: null } } })
    return Promise.resolve({ data: { data: [] } })
  })
  return {
    ...actual,
    default: { get, post: vi.fn(() => Promise.resolve({ data: { data: { id: 'match-1' } } })), patch: vi.fn(() => Promise.resolve({ data: { data: {} } })) },
    unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
  }
})

describe('useMatchForm · initial scope seed (point 1)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('seeds customerId from initialCustomerId', () => {
    const { result } = renderHook(() => useMatchForm({
      candidateId: 'cand-1', onClose: vi.fn(), onCreated: vi.fn(), initialCustomerId: 'cust-1',
    }))
    expect(result.current.customerId).toBe('cust-1')
  })

  it('seeds location/department WITHOUT the mount-time cascade reset wiping them', async () => {
    const { result } = renderHook(() => useMatchForm({
      candidateId: 'cand-1', onClose: vi.fn(), onCreated: vi.fn(),
      initialCustomerId: 'cust-1', initialCustomerLocationId: 'loc-1', initialCustomerDepartmentId: 'dep-1',
    }))
    // Give the customer-cascade fetch + any effects a tick to settle.
    await waitFor(() => expect(result.current.locations.length).toBeGreaterThan(0))
    expect(result.current.locationId).toBe('loc-1')
    expect(result.current.departmentId).toBe('dep-1')
  })

  it('stays a PREFILL, not a lock — the recruiter can still change the customer by hand', () => {
    const { result } = renderHook(() => useMatchForm({
      candidateId: 'cand-1', onClose: vi.fn(), onCreated: vi.fn(),
      initialCustomerId: 'cust-1', initialCustomerLocationId: 'loc-1',
    }))
    expect(result.current.locationId).toBe('loc-1')
    // Picking a DIFFERENT customer by hand still clears location/department
    // normally — the seed guard is one-shot, not a permanent bypass.
    act(() => { result.current.setCustomerId('cust-2') })
    expect(result.current.locationId).toBe('')
  })

  it('defaults to today\'s exact prior behaviour when no initial scope is given', () => {
    const { result } = renderHook(() => useMatchForm({ candidateId: 'cand-1', onClose: vi.fn(), onCreated: vi.fn() }))
    expect(result.current.customerId).toBe('')
    expect(result.current.locationId).toBe('')
    expect(result.current.departmentId).toBe('')
  })
})
