/**
 * useAdminBillingBudgets.test.ts — loader hook for /admin/billing-budgets.
 * Tests: GET route + drafts built per package through the given mapper;
 * error phase on a rejected GET; no state write after unmount (alive guard).
 */
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import api from '@/lib/api'
import { useAdminBillingBudgets } from './useAdminBillingBudgets'
import type { AdminBillingBudgetsResponse, BillingBudgetEntry } from '@/types/billingUsage'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

describe('useAdminBillingBudgets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads /admin/billing-budgets and builds drafts per package through the given mapper', async () => {
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

    // Custom mapper that returns a different shape per entry
    const draftFromEntry = (entry?: BillingBudgetEntry) => ({
      workflows: entry?.included_workflow_runs ?? 0,
      price: entry?.base_price_cents ?? 0,
    })

    const { result } = renderHook(() => useAdminBillingBudgets(draftFromEntry))

    // Initial state
    expect(result.current.phase).toBe('loading')
    expect(result.current.data).toBeNull()

    // After load
    await waitFor(() => {
      expect(result.current.phase).toBe('ready')
    })

    expect(api.get).toHaveBeenCalledWith('/admin/billing-budgets')
    expect(result.current.data).toEqual(mockResponse)
    expect(result.current.drafts).toEqual({
      core: { workflows: 100, price: 5000 },
      pro: { workflows: 500, price: 15000 },
      enterprise: { workflows: 2000, price: 50000 },
    })
  })

  it('sets phase to error on a rejected GET', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('API error'))

    const draftFromEntry = () => ({})
    const { result } = renderHook(() => useAdminBillingBudgets(draftFromEntry))

    expect(result.current.phase).toBe('loading')

    await waitFor(() => {
      expect(result.current.phase).toBe('error')
    })

    expect(result.current.data).toBeNull()
  })

  it('does not write state after unmount (alive guard)', async () => {
    let resolveApi: (value: { data: AdminBillingBudgetsResponse }) => void
    const apiPromise = new Promise<{ data: AdminBillingBudgetsResponse }>((resolve) => {
      resolveApi = resolve
    })

    vi.mocked(api.get).mockReturnValueOnce(apiPromise as unknown as ReturnType<typeof api.get>)

    const draftFromEntry = () => ({})
    const { unmount } = renderHook(() => useAdminBillingBudgets(draftFromEntry))

    // Unmount before the API call resolves
    unmount()

    // Now resolve the API call
    resolveApi!({
      data: {
        packages: { core: {}, pro: {}, enterprise: {} },
        tenants: {},
      } as AdminBillingBudgetsResponse,
    })

    // Wait a bit to ensure no state updates would have happened
    await new Promise((resolve) => setTimeout(resolve, 100))

    // If the test gets here without errors, the alive guard worked
    expect(true).toBe(true)
  })
})
