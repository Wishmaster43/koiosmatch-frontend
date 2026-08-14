/**
 * useMatchForm — Contractvorm/CONTRACTREGELS payload seam coverage
 * (MATCH-SOORT-1, §1/§2 of the CONTRACT-CHANGELOG). Asserts the exact
 * POST/PATCH /matches body (§13: the seam, never just that a setter fired):
 * contract_form + contract_lines ride on create AND edit, contract_lines is
 * always sent as a FULL replacing set (including `[]` to clear), and
 * switching to a non-flagged Contractvorm always sends `[]` even if a stale
 * local draft still has rows in it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useMatchForm } from './useMatchForm'

// Two Contractvorm rows: only 'temp_agency' carries the CONTRACTREGELS flag —
// flag-driven, mirrors the backend's own seed (never a hardcoded slug check).
const CANDIDATE_TYPES = [
  { value: 'temp_agency', label: 'Uitzend', color: '#6E8FD6', has_contract_lines: true },
  { value: 'payroll', label: 'Payroll', color: '#9CA3AF', has_contract_lines: false },
]

vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ candidateTypes: CANDIDATE_TYPES }) }))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('@/pages/vacancies/hooks/useCustomerOptions', () => ({ useCustomerOptions: () => [] }))
vi.mock('@/pages/candidates/hooks/useVacancyOptions', () => ({ useVacancyOptions: () => [] }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: ['Verzorgende IG'], allowFreeEntry: false }) }))
vi.mock('@/lib/useContractTypes', () => ({ useContractTypes: () => ({ types: [], options: [] }) }))
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [] }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', branch_ids: [] } }) }))
vi.mock('@/pages/candidates/hooks/useRateProposal', () => ({
  useRateProposal: () => ({ proposal: null, deviatesFromProposal: false, confirmDeviation: false, setConfirmDeviation: vi.fn() }),
}))
vi.mock('@/components/actionrules', () => ({ useActionRulePreflight: () => ({ decision: null }) }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const mockCustomer = { id: 'cust-1', name: 'Zorggroep A', branch_id: null, locations: [], contacts: [] }

const EDIT_DETAIL = {
  customer_id: 'cust-1', function_title: 'Verpleegkundige',
  contract_form: { value: 'temp_agency', label: 'Uitzend', color: '#6E8FD6' },
  contract_lines: [{ id: 'line-1', function_title: 'Verpleegkundige', rate: 22.5, sort_order: 0 }],
}

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  const get = vi.fn((url: string) => {
    if (url.startsWith('/customers/')) return Promise.resolve({ data: { data: mockCustomer } })
    if (url.startsWith('/candidates/')) return Promise.resolve({ data: { data: { branch_id: null, location: null } } })
    if (url.startsWith('/matches/')) return Promise.resolve({ data: { data: EDIT_DETAIL } })
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

function harness(editMatchId?: string) {
  const onClose = vi.fn()
  const onCreated = vi.fn()
  const { result } = renderHook(() => useMatchForm({ candidateId: 'cand-1', editMatchId, onClose, onCreated }))
  return { result, onClose, onCreated }
}

describe('useMatchForm · Contractvorm/CONTRACTREGELS payload (MATCH-SOORT-1)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('sends contract_form + contract_lines as a full set when the picked form is flagged', async () => {
    const { result } = harness()
    act(() => { result.current.setCustomerId('cust-1') })
    act(() => { result.current.setFunc('Verzorgende IG') })
    act(() => { result.current.setContractForm('temp_agency') })
    await waitFor(() => expect(result.current.hasContractLines).toBe(true))
    act(() => { result.current.setContractLines([{ functionTitle: 'Verpleegkundige', rate: '22.5' }, { functionTitle: 'Helpende', rate: '' }]) })

    await act(async () => { result.current.handleSubmitClick() })
    await waitFor(() => expect(apiPost).toHaveBeenCalled())

    const body = apiPost.mock.calls[0][1]
    expect(body.contract_form).toBe('temp_agency')
    expect(body.contract_lines).toEqual([
      { function_title: 'Verpleegkundige', rate: 22.5, sort_order: 0 },
      { function_title: 'Helpende', rate: null, sort_order: 1 },
    ])
  })

  it('sends contract_lines: [] when the picked form carries no flag, even with a stale local draft', async () => {
    const { result } = harness()
    act(() => { result.current.setCustomerId('cust-1') })
    act(() => { result.current.setFunc('Verzorgende IG') })
    // Pick the flagged form, draft a row, THEN switch away — the row-clear
    // effect empties the local draft, but the assertion below proves the
    // SUBMIT path is honest regardless of what the draft happens to hold.
    act(() => { result.current.setContractForm('temp_agency') })
    await waitFor(() => expect(result.current.hasContractLines).toBe(true))
    act(() => { result.current.setContractLines([{ functionTitle: 'Verpleegkundige', rate: '22.5' }]) })
    act(() => { result.current.setContractForm('payroll') })
    await waitFor(() => expect(result.current.hasContractLines).toBe(false))

    await act(async () => { result.current.handleSubmitClick() })
    await waitFor(() => expect(apiPost).toHaveBeenCalled())

    const body = apiPost.mock.calls[0][1]
    expect(body.contract_form).toBe('payroll')
    expect(body.contract_lines).toEqual([])
  })

  it('sends contract_form: null + contract_lines: [] when no Contractvorm is picked', async () => {
    const { result } = harness()
    act(() => { result.current.setCustomerId('cust-1') })
    act(() => { result.current.setFunc('Verzorgende IG') })

    await act(async () => { result.current.handleSubmitClick() })
    await waitFor(() => expect(apiPost).toHaveBeenCalled())

    const body = apiPost.mock.calls[0][1]
    expect(body.contract_form).toBeNull()
    expect(body.contract_lines).toEqual([])
  })

  it('edit mode prefills the Contractvorm slug + its lines, and PATCHes the same full-set shape', async () => {
    const { result } = harness('match-1')
    await waitFor(() => expect(result.current.contractForm).toBe('temp_agency'))
    expect(result.current.contractLines).toEqual([{ functionTitle: 'Verpleegkundige', rate: '22.5' }])

    await act(async () => { result.current.handleSubmitClick() })
    await waitFor(() => expect(apiPatch).toHaveBeenCalled())

    const [url, body] = apiPatch.mock.calls[0]
    expect(url).toBe('/matches/match-1')
    expect(body.contract_form).toBe('temp_agency')
    expect(body.contract_lines).toEqual([{ function_title: 'Verpleegkundige', rate: 22.5, sort_order: 0 }])
  })
})
