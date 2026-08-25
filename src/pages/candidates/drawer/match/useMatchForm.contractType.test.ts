/**
 * LOOKUP-I18N-1 (25-08): the field holds the lookup VALUE, not the displayed label.
 * It used to hold the label, which was harmless while every label was Dutch — once
 * seeded labels are translated, a German user posted "Befristet" and the backend
 * (MatchRules::resolve, value or Dutch seed label) rejected the save.
 *
 * useMatchForm — contract-type lookup coverage for the two tenant-
 * configurable columns GET /contract-types really returns: `is_default` (the
 * singleton "propose this type" flag) and `default_duration_days` (the end-date
 * proposal). Both were previously documented as not-yet-shipped backend columns;
 * they exist, so these tests pin the behaviour now that the gate is lifted.
 *
 * Every test asserts the SEAM (§13) — the exact POST/PATCH request and its body —
 * not merely that a setter or callback fired. The one display-level assertion
 * (edit prefill) also checks the request it produces.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useMatchForm } from './useMatchForm'
import { addDays } from './helpers'

// The lookup as the real API serialises it: an immutable slug `value`, the tenant's
// editable `label`, plus the two columns under test. `bepaalde_tijd` carries a
// 90-day term, `zzp` is the tenant's flagged default.
const CONTRACT_TYPE_OPTIONS = [
  { value: 'bepaalde_tijd', label: 'Bepaalde tijd', default_duration_days: 90, is_default: false },
  { value: 'zzp', label: 'ZZP', default_duration_days: null, is_default: true },
]

// Customer fixture with no branch, so useBranchMismatch never fires and the
// post-submit branch-move PATCH stays out of these assertions.
const mockCustomer = { id: 'cust-1', name: 'Zorggroep A', branch_id: null, locations: [], contacts: [] }

// Only useContractTypes is stubbed out of this module — `contractTypeLabel` must stay
// REAL, since the slug→label canonicalisation under test is exactly that function.
// The stub resolves on a MACROTASK, mirroring useCachedLookup: the real lookup arrives
// over the network, so it lands AFTER the GET /matches/{id} prefill (a microtask).
// That ordering is what an edit form actually sees, and it is where a create-only
// proposal would otherwise overwrite the record the recruiter just opened.
vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ candidateTypes: [] }) }))
vi.mock('@/lib/useContractTypes', async () => {
  const actual = await vi.importActual<typeof import('@/lib/useContractTypes')>('@/lib/useContractTypes')
  const { useState, useEffect } = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useContractTypes: () => {
      const [options, setOptions] = useState<typeof CONTRACT_TYPE_OPTIONS>([])
      useEffect(() => { const id = setTimeout(() => setOptions(CONTRACT_TYPE_OPTIONS), 0); return () => clearTimeout(id) }, [])
      return { types: options.map(o => o.label), options }
    },
  }
})

// Minimal static mocks for every other relational/lookup hook (mirrors the sibling
// useMatchForm.test.ts setup) — none of them is under test here.
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('@/pages/vacancies/hooks/useCustomerOptions', () => ({ useCustomerOptions: () => [] }))
vi.mock('@/pages/candidates/hooks/useVacancyOptions', () => ({ useVacancyOptions: () => [] }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: ['Verzorgende IG'], allowFreeEntry: false }) }))
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [] }))
vi.mock('@/lib/useCao', () => ({ useCao: () => ({ types: [] }) }))
vi.mock('@/lib/useContactFunctions', () => ({ useContactFunctions: () => ({ contactFunctions: [], allowFreeEntry: false }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', branch_ids: [] } }) }))
vi.mock('@/pages/candidates/hooks/useRateProposal', () => ({
  useRateProposal: () => ({ proposal: null, deviatesFromProposal: false, confirmDeviation: false, setConfirmDeviation: vi.fn() }),
}))
vi.mock('@/components/actionrules', () => ({ useActionRulePreflight: () => ({ decision: null }) }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// GET /matches/{id} feeds the edit-prefill tests; each test sets its own record.
let editRecord: Record<string, unknown> = {}
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  const get = vi.fn((url: string) => {
    if (url.startsWith('/customers/')) return Promise.resolve({ data: { data: mockCustomer } })
    if (url.startsWith('/matches/')) return Promise.resolve({ data: { data: editRecord } })
    if (url.startsWith('/candidates/')) return Promise.resolve({ data: { data: { branch_id: null } } })
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
const apiPatch = api.patch as unknown as ReturnType<typeof vi.fn>

// Renders the hook for a create (no editMatchId) or an edit (editMatchId set).
function harness(editMatchId?: string) {
  const onClose = vi.fn()
  const onCreated = vi.fn()
  const { result } = renderHook(() => useMatchForm({ candidateId: 'cand-1', editMatchId, onClose, onCreated }))
  return { result, onClose, onCreated }
}

describe('useMatchForm · contract-type lookup (is_default + default_duration_days)', () => {
  beforeEach(() => { vi.clearAllMocks(); editRecord = {} })

  it('CREATE: posts the tenant is_default type as its VALUE, the only form that survives translation', async () => {
    const { result } = harness()
    // The proposal lands as soon as the options resolve — into an empty field only.
    await waitFor(() => expect(result.current.contractType).toBe('zzp'))

    act(() => { result.current.setCustomerId('cust-1') })
    act(() => { result.current.setFunc('Verzorgende IG') })
    act(() => { result.current.handleSubmitClick() })

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/matches', expect.objectContaining({
      candidate_id: 'cand-1', contract_type: 'zzp',
    })))
  })

  it('CREATE: a type carrying default_duration_days proposes the end date into the POST body', async () => {
    const { result } = harness()
    await waitFor(() => expect(result.current.contractType).toBe('zzp'))

    // Pick the 90-day type over the proposed default, with an explicit start date.
    act(() => { result.current.setStartDate('2026-03-01') })
    act(() => { result.current.setContractType('bepaalde_tijd') })
    act(() => { result.current.setCustomerId('cust-1') })
    act(() => { result.current.setFunc('Verzorgende IG') })
    await waitFor(() => expect(result.current.endDate).toBe(addDays('2026-03-01', 90)))

    act(() => { result.current.handleSubmitClick() })

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/matches', expect.objectContaining({
      contract_type: 'bepaalde_tijd', start_date: '2026-03-01', end_date: '2026-05-30',
    })))
  })

  it('EDIT: keeps the stored slug in state and PATCHes it back unchanged (the picker shows the label)', async () => {
    editRecord = { customer_id: 'cust-1', function_title: 'Verzorgende IG', contract_type: 'bepaalde_tijd' }
    const { result } = harness('match-9')

    // The record stores the slug and the field keeps it; the picker resolves the label
    // from its options, so nothing translated ever reaches contract_type.
    await waitFor(() => expect(result.current.contractType).toBe('bepaalde_tijd'))

    act(() => { result.current.handleSubmitClick() })

    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/matches/match-9', expect.objectContaining({
      contract_type: 'bepaalde_tijd',
    })))
  })

  it('EDIT: never writes the tenant default into a match that has no contract type', async () => {
    editRecord = { customer_id: 'cust-1', function_title: 'Verzorgende IG', contract_type: null }
    const { result } = harness('match-9')

    // Wait past BOTH async sources: the record prefill and the later lookup resolve.
    await waitFor(() => expect(result.current.customerId).toBe('cust-1'))
    await waitFor(() => expect(result.current.contractTypeOptions.length).toBe(2))
    // The is_default proposal is create-only: an edit form must not silently fill it.
    expect(result.current.contractType).toBe('')

    act(() => { result.current.handleSubmitClick() })

    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/matches/match-9', expect.objectContaining({
      contract_type: null,
    })))
  })

  it('CREATE: a cleared field stays cleared — the proposal is one-shot, never re-imposed', async () => {
    const { result } = harness()
    await waitFor(() => expect(result.current.contractType).toBe('zzp'))

    act(() => { result.current.setContractType('') })
    act(() => { result.current.setCustomerId('cust-1') })
    act(() => { result.current.setFunc('Verzorgende IG') })
    act(() => { result.current.handleSubmitClick() })

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/matches', expect.objectContaining({
      contract_type: null,
    })))
  })
})
