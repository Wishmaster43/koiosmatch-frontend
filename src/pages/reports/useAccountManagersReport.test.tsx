/**
 * useAccountManagersReport — request-shape test (§13: assert the REQUEST).
 * Proves the plain endpoint call and, critically, that `accountManagersOverrideParams`
 * is the ONE place `months`/`contract_ending_days` are read from — the exact
 * function AccountManagersReport.tsx reuses to build its compare extraParams, so
 * an override can never reach the plain fetch with one value and the compare
 * call with another.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useAccountManagersReport, accountManagersOverrideParams } from './useAccountManagersReport'

const getSpy = vi.fn().mockResolvedValue({ data: { period: 'month', compliance_days: 90, contract_ending_days: 30, account_managers: [] } })
vi.mock('@/lib/api', () => ({ default: { get: (...args: unknown[]) => getSpy(...args) } }))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('accountManagersOverrideParams — the ONE override → query-key mapping', () => {
  it('omits both keys when neither override is set (tenant setting drives both windows)', () => {
    expect(accountManagersOverrideParams({})).toEqual({})
  })

  it('maps months/contractEndingDays to the exact backend query keys', () => {
    expect(accountManagersOverrideParams({ months: 3, contractEndingDays: 45 })).toEqual({ months: 3, contract_ending_days: 45 })
  })

  it('a single override key applies independently — never forces the other', () => {
    expect(accountManagersOverrideParams({ months: 3 })).toEqual({ months: 3 })
    expect(accountManagersOverrideParams({ contractEndingDays: 45 })).toEqual({ contract_ending_days: 45 })
  })
})

describe('useAccountManagersReport — request shape', () => {
  afterEach(() => getSpy.mockClear())

  it('requests GET /reports/accountmanagers with just the period when no override is set', async () => {
    const { result } = renderHook(() => useAccountManagersReport('month'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getSpy).toHaveBeenCalledWith('/reports/accountmanagers', expect.objectContaining({ params: { period: 'month' } }))
  })

  it('folds months/contract_ending_days into the SAME request as the period', async () => {
    const { result } = renderHook(() => useAccountManagersReport('month', { months: 3, contractEndingDays: 45 }), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getSpy).toHaveBeenCalledWith('/reports/accountmanagers', expect.objectContaining({
      params: { period: 'month', months: 3, contract_ending_days: 45 },
    }))
  })
})
