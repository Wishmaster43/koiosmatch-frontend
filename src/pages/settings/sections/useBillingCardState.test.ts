/**
 * useBillingCardState.test.ts — shared head of the two billing cards: the
 * /admin/billing-budgets load (via useAdminBillingBudgets) plus the
 * saving/savedOk confirmation flags each card's SaveButton pattern uses.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import api from '@/lib/api'
import { useBillingCardState } from './useBillingCardState'
import type { AdminBillingBudgetsResponse } from '@/types/billingUsage'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

describe('useBillingCardState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads /admin/billing-budgets and starts with saving/savedOk both false', async () => {
    const mockResponse: AdminBillingBudgetsResponse = {
      packages: {
        core: { included_workflow_runs: 100, base_price_cents: 5000 },
        pro: { included_workflow_runs: 500, base_price_cents: 15000 },
        enterprise: { included_workflow_runs: 2000, base_price_cents: 50000 },
      },
      tenants: {},
      resets_at: '2026-10-01T00:00:00Z',
    }
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockResponse })

    const draftFromEntry = (entry?: { included_workflow_runs?: number }) => ({ workflows: entry?.included_workflow_runs ?? 0 })
    const { result } = renderHook(() => useBillingCardState(draftFromEntry))

    expect(result.current.saving).toBe(false)
    expect(result.current.savedOk).toBe(false)

    await waitFor(() => expect(result.current.phase).toBe('ready'))

    expect(api.get).toHaveBeenCalledWith('/admin/billing-budgets')
    expect(result.current.data).toEqual(mockResponse)
  })

  it('exposes independent setSaving/setSavedOk setters', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { packages: {}, tenants: {} } })
    const draftFromEntry = () => ({})
    const { result } = renderHook(() => useBillingCardState(draftFromEntry))

    act(() => { result.current.setSaving(true) })
    expect(result.current.saving).toBe(true)
    expect(result.current.savedOk).toBe(false)

    act(() => { result.current.setSaving(false); result.current.setSavedOk(true) })
    expect(result.current.saving).toBe(false)
    expect(result.current.savedOk).toBe(true)
  })
})
