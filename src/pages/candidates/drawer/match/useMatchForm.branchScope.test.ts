/**
 * useMatchForm · branch-scope narrowing (ONIX D-003) — the match's Vestiging
 * picker (`branchLocations`) narrows to the signed-in user's own branch grants
 * via useAssignableBranches; `exposedBranchLocations` (returned under the same
 * `branchLocations` key) re-adds the currently-picked branch with its real
 * label when it falls outside those grants, so a branch set before the viewer's
 * grants narrowed never silently vanishes from the picker.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useMatchForm } from './useMatchForm'

const mockCustomer = { id: 'cust-1', name: 'Zorggroep A', locations: [], contacts: [] }

vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ candidateTypes: [] }) }))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('@/hooks/useCustomerOptions', () => ({ useCustomerOptions: () => [] }))
vi.mock('@/pages/candidates/hooks/useVacancyOptions', () => ({ useVacancyOptions: () => [] }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: [], allowFreeEntry: false }) }))
vi.mock('@/lib/useContractTypes', () => ({ useContractTypes: () => ({ types: [], options: [] }) }))
// Two branches; the grant below narrows to one of them.
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [{ value: 'b1', label: 'Hoofdkantoor' }, { value: 'b2', label: 'Bijkantoor' }] }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', branch_ids: ['b1'] } }) }))
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

describe('useMatchForm · branch-scope narrowing (ONIX D-003)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists only the granted branch (b1), hiding b2', () => {
    const { result } = renderHook(() => useMatchForm({ candidateId: 'cand-1', onClose: vi.fn(), onCreated: vi.fn() }))
    expect(result.current.branchLocations.map(l => l.value)).toEqual(['b1'])
  })

  it('re-adds the picked out-of-grant branch (b2) with its real label once chosen', async () => {
    const { result } = renderHook(() => useMatchForm({ candidateId: 'cand-1', onClose: vi.fn(), onCreated: vi.fn() }))
    // Mirrors RelationsSection's own picker onChange: freeze the auto-propose
    // first (setBranchDirty), then set the value — otherwise the hook's
    // propose-until-touched effect (useBranchDefault) reverts the pick.
    act(() => { result.current.setBranchDirty(true); result.current.setBranchId('b2') })
    await waitFor(() => expect(result.current.branchId).toBe('b2'))
    const values = result.current.branchLocations.map(l => l.value)
    expect(values).toContain('b1')
    expect(values).toContain('b2')
    expect(result.current.branchLocations.find(l => l.value === 'b2')?.label).toBe('Bijkantoor')
  })
})
