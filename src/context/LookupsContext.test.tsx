/**
 * LookupsContext — K-281 repair pass 3 (Opus find): normalize()'s flag
 * whitelist DROPPED `customer_not_applicable` and `has_contract_lines`, so
 * `typeMeta(...)?.customer_not_applicable` was always undefined on a REAL
 * tenant fetch (only the seed fallback ever carried them) — silently
 * breaking MATCH-KLANTLOOS-1's customerNotApplicable branch (useMatchForm.ts)
 * and MATCH-SOORT-1's CONTRACTREGELS gate, and letting MatchClientRow's
 * pencil render (then 422) on a klant-loos match.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { LookupsProvider, useLookups } from './LookupsContext'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)

// The fetch effect gates on a logged-in user AND a chosen bureau (LookupsContext.tsx) — a fake
// session in mutable state so the bureau-pick gate can be driven per test (vi.hoisted: the mock
// factory runs above the imports). Mirrors AddCandidateModal.test.tsx's own useAuth mock.
const authState = vi.hoisted(() => ({ current: { user: { id: 'u1', name: 'Piet Recruiter' } } as Record<string, unknown> }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => authState.current }))

const wrapper = ({ children }: { children: ReactNode }) => <LookupsProvider>{children}</LookupsProvider>

afterEach(() => { vi.clearAllMocks(); authState.current = { user: { id: 'u1', name: 'Piet Recruiter' } } })

// Fixtures carry no `color`: normalize() falls back to its own default for a missing
// colour, so the flag seam is proven without a hex literal in a test file (ceiling 0).
describe('LookupsContext · candidateTypes flags reach typeMeta (K-281 repair pass 3)', () => {
  it('carries customer_not_applicable through from a real tenant row', async () => {
    mockedGet.mockResolvedValue({
      data: { candidate_types: [{ value: 'klantloos', label: 'Klantloos', customer_not_applicable: true }] },
    })
    const { result } = renderHook(() => useLookups(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockedGet).toHaveBeenCalledWith('/settings/candidate-lookups?active=1')
    expect(result.current.typeMeta('klantloos').customer_not_applicable).toBe(true)
  })

  it('carries has_contract_lines through from a real tenant row', async () => {
    mockedGet.mockResolvedValue({
      data: { candidate_types: [{ value: 'flex_services', label: 'Flex-diensten', has_contract_lines: true }] },
    })
    const { result } = renderHook(() => useLookups(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.typeMeta('flex_services').has_contract_lines).toBe(true)
  })

  it('leaves both flags falsy for an ordinary Contractvorm row', async () => {
    mockedGet.mockResolvedValue({
      data: { candidate_types: [{ value: 'freelance', label: 'ZZP' }] },
    })
    const { result } = renderHook(() => useLookups(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.typeMeta('freelance').customer_not_applicable).toBeFalsy()
    expect(result.current.typeMeta('freelance').has_contract_lines).toBeFalsy()
  })
})

// TENANT-GATE-FE-1 (29-10, Danny's console on TenantPickPage): a bureau route before the super
// admin picked a bureau is a 400 tenant_required by design (ONIX B-003), and the old `[user?.id]`
// dependency never refetched after the pick or a tenant switch.
describe('LookupsContext · bureau gate (ONIX B-003 tenant_required)', () => {
  it('asks nothing while a bureau still has to be picked, then fetches once one is set', async () => {
    authState.current = { user: { id: 'u1' }, needsTenantPick: true, activeTenant: null }
    mockedGet.mockResolvedValue({ data: {} })
    const { result, rerender } = renderHook(() => useLookups(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockedGet).not.toHaveBeenCalled()
    authState.current = { user: { id: 'u1' }, needsTenantPick: false, activeTenant: { id: 't1' } }
    rerender()
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1))
    expect(mockedGet).toHaveBeenCalledWith('/settings/candidate-lookups?active=1')
  })

  it('refetches the lookups when the active bureau changes for the same user', async () => {
    authState.current = { user: { id: 'u1' }, needsTenantPick: false, activeTenant: { id: 't1' } }
    mockedGet.mockResolvedValue({ data: {} })
    const { rerender } = renderHook(() => useLookups(), { wrapper })
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1))
    authState.current = { user: { id: 'u1' }, needsTenantPick: false, activeTenant: { id: 't2' } }
    rerender()
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2))
  })
})
