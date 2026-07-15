/**
 * useRateProposal — regression tests for the two load-bearing rules:
 * (1) prefill only STILL-EMPTY rate fields from a found proposal;
 * (2) the deviation guard fires only for a FOUND 'agreement' proposal whose
 *     entered rates differ cent-precisely (Danny's "weet je het zeker?").
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRateProposal } from './useRateProposal'
import api from '@/lib/api'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)

// Base props; individual tests override rates/setters as needed.
const baseProps = {
  customerId: 'c1', functionTitle: 'Verpleegkundige',
  purchase: '', sell: '', setPurchase: vi.fn(), setSell: vi.fn(),
}

const agreement = { found: true, agreement_id: 'pa1', purchase_rate: 30, sale_rate: 45, margin: 15, source: 'agreement' }

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

// Run the debounce timer, then flush the promise chain on real timers.
async function settle() {
  await act(async () => { vi.advanceTimersByTime(450) })
  vi.useRealTimers()
  await act(async () => { await Promise.resolve() })
  vi.useFakeTimers()
}

describe('useRateProposal', () => {
  it('prefills empty purchase/sell from a found agreement proposal', async () => {
    mockedGet.mockResolvedValue({ data: agreement })
    const setPurchase = vi.fn(); const setSell = vi.fn()
    renderHook(() => useRateProposal({ ...baseProps, setPurchase, setSell }))
    await settle()
    expect(setPurchase).toHaveBeenCalledWith('30')
    expect(setSell).toHaveBeenCalledWith('45')
  })

  it('never overwrites rates the recruiter already typed', async () => {
    mockedGet.mockResolvedValue({ data: agreement })
    const setPurchase = vi.fn(); const setSell = vi.fn()
    renderHook(() => useRateProposal({ ...baseProps, purchase: '28', sell: '50', setPurchase, setSell }))
    await settle()
    expect(setPurchase).not.toHaveBeenCalled()
    expect(setSell).not.toHaveBeenCalled()
  })

  it('skips the sell prefill for a purchase_only proposal', async () => {
    mockedGet.mockResolvedValue({ data: { ...agreement, source: 'purchase_only' } })
    const setSell = vi.fn()
    renderHook(() => useRateProposal({ ...baseProps, setSell }))
    await settle()
    expect(setSell).not.toHaveBeenCalled()
  })

  it('flags a cent-precise deviation from a found agreement', async () => {
    mockedGet.mockResolvedValue({ data: agreement })
    const { result } = renderHook(() => useRateProposal({ ...baseProps, purchase: '30', sell: '45.01' }))
    await settle()
    expect(result.current.deviatesFromProposal).toBe(true)
  })

  it('does NOT guard when the entered rates equal the agreement', async () => {
    mockedGet.mockResolvedValue({ data: agreement })
    const { result } = renderHook(() => useRateProposal({ ...baseProps, purchase: '30', sell: '45' }))
    await settle()
    expect(result.current.deviatesFromProposal).toBe(false)
  })

  it('does NOT guard for conversion_factor/purchase_only estimates', async () => {
    mockedGet.mockResolvedValue({ data: { ...agreement, source: 'conversion_factor' } })
    const { result } = renderHook(() => useRateProposal({ ...baseProps, purchase: '99', sell: '99' }))
    await settle()
    expect(result.current.deviatesFromProposal).toBe(false)
  })

  it('re-arms the confirm flag when a rate changes after confirming', async () => {
    mockedGet.mockResolvedValue({ data: agreement })
    const { result, rerender } = renderHook(
      (p: { purchase: string; sell: string }) => useRateProposal({ ...baseProps, ...p }),
      { initialProps: { purchase: '30', sell: '46' } },
    )
    await settle()
    act(() => result.current.setConfirmDeviation(true))
    expect(result.current.confirmDeviation).toBe(true)
    rerender({ purchase: '30', sell: '47' })
    expect(result.current.confirmDeviation).toBe(false)
  })
})
