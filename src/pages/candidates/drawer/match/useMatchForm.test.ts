/**
 * useMatchForm — branch-mismatch resolution PATCH regression coverage
 * (the post-submit best-effort branch move, fase 3). BUG CLASS FIX: this call
 * used to end in `.catch(() => {})` — a fully silent best-effort write, so a
 * failed branch move left the recruiter believing the candidate's branch had
 * moved when it hadn't, with zero feedback. It must STAY best-effort (its
 * failure must never roll back or block the match that was just created — see
 * the source comment) but must now report its own failure with a specific
 * message. These tests assert the SEAM (§13), not a callback: the exact PATCH
 * request, and that the overall create still reports success while a distinct
 * error toast fires for the branch-move failure alone.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useMatchForm } from './useMatchForm'

// Customer fixture: its OWN branch differs from the candidate's branch below, so
// `branchMismatch` (useBranchMismatch) resolves true once both GETs settle.
const mockCustomer = {
  id: 'cust-1', name: 'Zorggroep A',
  branch_id: 'branch-cust', branch: { id: 'branch-cust', name: 'Klant Vestiging' },
  locations: [], contacts: [],
}

// Every relational/tenant-lookup hook this form pulls in gets a minimal, static
// mock (mirrors MatchModal.test.tsx's own setup) — this test only cares
// about the branch-mismatch resolution PATCH, not the rest of the form's wiring.
// useCustomerCascade/useBranchMismatch stay REAL (driven by the mocked api.get
// below) since the mismatch itself is what's under test.
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

// GET /customers/{id} → the fixture; GET /candidates/{id} → a branch that
// deliberately differs from the customer's, so the mismatch logic fires. CAO
// (/cao) and contact-functions (/contact-functions) fall through to their real
// seed fallbacks (kept un-mocked, same as MatchModal.test.tsx).
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  const get = vi.fn((url: string) => {
    if (url.startsWith('/customers/')) return Promise.resolve({ data: { data: mockCustomer } })
    if (url.startsWith('/candidates/')) return Promise.resolve({ data: { data: { branch_id: 'branch-cand', location: { name: 'Kandidaat Vestiging' } } } })
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
import { notifyError, notifySuccess } from '@/lib/notify'

const apiPatch = api.patch as unknown as ReturnType<typeof vi.fn>
const apiPost = api.post as unknown as ReturnType<typeof vi.fn>

// Harness: real onClose/onCreated spies, a fixed candidate (so the candidate-
// picker effect never fires) — drives the form via its own returned setters,
// exactly like a recruiter filling the panel in, then submits via handleSubmitClick.
function harness() {
  const onClose = vi.fn()
  const onCreated = vi.fn()
  const { result } = renderHook(() => useMatchForm({ candidateId: 'cand-1', onClose, onCreated }))
  return { result, onClose, onCreated }
}

describe('useMatchForm · branch-mismatch resolution PATCH', () => {
  beforeEach(() => { vi.clearAllMocks() })

  // Drives the harness up to a submit-ready, mismatched, "also move" state.
  const setUpMismatch = async (result: ReturnType<typeof harness>['result']) => {
    act(() => { result.current.setCustomerId('cust-1') })
    act(() => { result.current.setFunc('Verzorgende IG') })
    await waitFor(() => expect(result.current.branchMismatch).toBe(true))
    act(() => { result.current.setMismatchChoice('candidate') })
  }

  it('sends the candidate branch-move PATCH after a successful match create', async () => {
    const { result, onClose, onCreated } = harness()
    await setUpMismatch(result)

    act(() => { result.current.handleSubmitClick() })

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/matches', expect.objectContaining({ candidate_id: 'cand-1' })))
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/candidates/cand-1', { location_id: 'branch-cust' }))
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith('placement.created'))
    expect(notifyError).not.toHaveBeenCalled()
    expect(onCreated).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('stays best-effort: a FAILED branch-move never blocks or rolls back the just-created match, but reports its OWN message', async () => {
    apiPatch.mockRejectedValueOnce(new Error('network down'))
    const { result, onClose, onCreated } = harness()
    await setUpMismatch(result)

    act(() => { result.current.handleSubmitClick() })

    // The match itself still succeeds — its own failure must never be implied.
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith('placement.created'))
    // BUG CLASS FIX: previously nothing was shown at all for this failure.
    expect(notifyError).toHaveBeenCalledWith('placement.branchMoveFailed')
    expect(onCreated).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('never sends the branch-move PATCH when the recruiter keeps the default "match only" choice', async () => {
    const { result } = harness()
    act(() => { result.current.setCustomerId('cust-1') })
    act(() => { result.current.setFunc('Verzorgende IG') })
    await waitFor(() => expect(result.current.branchMismatch).toBe(true))
    // mismatchChoice stays at its default ('match') — never touched here.

    act(() => { result.current.handleSubmitClick() })

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/matches', expect.anything()))
    expect(apiPatch).not.toHaveBeenCalled()
  })
})
