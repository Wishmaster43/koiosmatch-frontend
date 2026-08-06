/**
 * useMatchForm · vacancy prefill (VACANCY-PREFILL-1, points 1/2/4/1.8.4, Danny's
 * ten-point round). Covers:
 *  - picking a vacancy prefills the real fields it knows and the POST body
 *    carries them (point 1);
 *  - vestiging inherits from the vacancy when set, else the candidate's own
 *    (point 2);
 *  - a field the recruiter already touched by hand survives a later prefill,
 *    field-by-field (point 4);
 *  - clearing the vacancy reverts ONLY the still-untouched auto-filled values —
 *    a touched one stays exactly as the recruiter left it (point 1.8.4).
 * Mirrors useMatchForm.initialScope.test.ts's mocking shape (the same hook
 * family's own precedent for a lightweight, non-component-rendering hook test).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useMatchForm } from './useMatchForm'

// Two customers, so a manually-picked customer (point 4's touched-field test)
// resolves to something distinct from the vacancy's own customer.
const mockCustomer = {
  id: 'cust-1', name: 'Zorggroep A',
  locations: [{ id: 'loc-1', name: 'Locatie Noord', departments: [{ id: 'dep-1', name: 'Afdeling A' }] }],
  contacts: [{ id: 'con-1', name: 'Jan Jansen' }],
}

// vac-1: every real, prefillable field present (point 1) — a single fixed hours
// value (min === max), so the honest hours-prefill guard applies it.
const vacancyWithEverything = {
  customer: { id: 'cust-1' }, customer_location_id: 'loc-1', customer_department_id: 'dep-1',
  contact_id: 'con-1', location_id: 'branch-vac', start_date: '2026-03-01', end_date: '2026-09-01',
  hours_min: 32, hours_max: 32,
}
// vac-branchless: no vestiging of its own — point 2's "else the candidate's own" fallback.
const vacancyNoBranch = { customer: { id: 'cust-1' }, location_id: null }
// vac-range: an hours RANGE (min !== max) — never guessed into a single value.
const vacancyHoursRange = { customer: { id: 'cust-1' }, hours_min: 24, hours_max: 40 }

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
    // Candidate's own branch (point 2 fallback) — no owner needed for this file.
    if (url === '/candidates/cand-1') return Promise.resolve({ data: { data: { branch_id: 'branch-cand', location: { name: 'Kandidaat Vestiging' } } } })
    if (url === '/vacancies/vac-everything') return Promise.resolve({ data: { data: vacancyWithEverything } })
    if (url === '/vacancies/vac-no-branch') return Promise.resolve({ data: { data: vacancyNoBranch } })
    if (url === '/vacancies/vac-range') return Promise.resolve({ data: { data: vacancyHoursRange } })
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
const apiPost = api.post as unknown as ReturnType<typeof vi.fn>

describe('useMatchForm · vacancy prefill (points 1/2/4/1.8.4)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('prefills every real field the vacancy carries, and the POST body carries them (point 1)', async () => {
    const { result } = renderHook(() => useMatchForm({ candidateId: 'cand-1', onClose: vi.fn(), onCreated: vi.fn() }))
    act(() => { result.current.setVacancyId('vac-everything') })
    await waitFor(() => expect(result.current.customerId).toBe('cust-1'))
    expect(result.current.locationId).toBe('loc-1')
    expect(result.current.departmentId).toBe('dep-1')
    expect(result.current.contactId).toBe('con-1')
    expect(result.current.branchId).toBe('branch-vac')
    expect(result.current.startDate).toBe('2026-03-01')
    expect(result.current.endDate).toBe('2026-09-01')
    expect(result.current.hours).toBe('32')

    act(() => { result.current.setFunc('Verzorgende IG') })
    act(() => { result.current.handleSubmitClick() })
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/matches', expect.objectContaining({
      customer_id: 'cust-1', customer_location_id: 'loc-1', customer_department_id: 'dep-1',
      contact_id: 'con-1', branch_id: 'branch-vac', start_date: '2026-03-01', end_date: '2026-09-01',
      hours_per_week: 32, vacancy_id: 'vac-everything',
    })))
  })

  it('never prefills hours from a genuine RANGE (min !== max) — no field lacks real data is guessed', async () => {
    const { result } = renderHook(() => useMatchForm({ candidateId: 'cand-1', onClose: vi.fn(), onCreated: vi.fn() }))
    act(() => { result.current.setVacancyId('vac-range') })
    await waitFor(() => expect(result.current.customerId).toBe('cust-1'))
    expect(result.current.hours).toBe('')
  })

  it('vestiging inherits from the vacancy when it carries one (point 2)', async () => {
    const { result } = renderHook(() => useMatchForm({ candidateId: 'cand-1', onClose: vi.fn(), onCreated: vi.fn() }))
    act(() => { result.current.setVacancyId('vac-everything') })
    await waitFor(() => expect(result.current.branchId).toBe('branch-vac'))
  })

  it('vestiging falls back to the CANDIDATE\'s own branch when the vacancy carries none (point 2)', async () => {
    const { result } = renderHook(() => useMatchForm({ candidateId: 'cand-1', onClose: vi.fn(), onCreated: vi.fn() }))
    act(() => { result.current.setVacancyId('vac-no-branch') })
    await waitFor(() => expect(result.current.customerId).toBe('cust-1'))
    await waitFor(() => expect(result.current.branchId).toBe('branch-cand'))
  })

  it('never overwrites a field the recruiter already touched by hand — field by field (point 4)', async () => {
    const { result } = renderHook(() => useMatchForm({ candidateId: 'cand-1', onClose: vi.fn(), onCreated: vi.fn() }))
    // Recruiter picks a customer BEFORE ever touching the vacancy field.
    act(() => { result.current.setCustomerId('cust-manual') })
    expect(result.current.customerId).toBe('cust-manual')

    act(() => { result.current.setVacancyId('vac-everything') })
    // Untouched fields still prefill from the vacancy...
    await waitFor(() => expect(result.current.locationId).toBe('loc-1'))
    expect(result.current.hours).toBe('32')
    // ...but the manually-picked customer survives untouched by the same prefill.
    expect(result.current.customerId).toBe('cust-manual')
  })

  it('clearing the vacancy reverts ONLY the still-untouched auto-filled values — a touched one stays (point 1.8.4)', async () => {
    const { result } = renderHook(() => useMatchForm({ candidateId: 'cand-1', onClose: vi.fn(), onCreated: vi.fn() }))
    act(() => { result.current.setVacancyId('vac-everything') })
    await waitFor(() => expect(result.current.customerId).toBe('cust-1'))
    expect(result.current.locationId).toBe('loc-1')
    expect(result.current.hours).toBe('32')

    // Recruiter overrides ONE of the auto-filled fields by hand.
    act(() => { result.current.setLocationId('loc-manual-override') })
    expect(result.current.locationId).toBe('loc-manual-override')

    // Clear the vacancy (the shared CreatableSelect's clearable X funnels here).
    act(() => { result.current.setVacancyId('') })

    // Every OTHER auto-filled field reverts to blank...
    expect(result.current.customerId).toBe('')
    expect(result.current.departmentId).toBe('')
    expect(result.current.contactId).toBe('')
    expect(result.current.branchId).toBe('')
    expect(result.current.startDate).toBe('')
    expect(result.current.endDate).toBe('')
    expect(result.current.hours).toBe('')
    // ...but the recruiter's own hand-typed value is never touched by the clear.
    expect(result.current.locationId).toBe('loc-manual-override')
  })
})
