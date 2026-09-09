/**
 * useShiftEligibleCandidates — ENT2-04 (contract audit 09-09): GET /planning/shifts/{id}/
 * candidates answers the single-level {data: [...]} envelope; a second `.data` read on
 * the unwrapped array left the pool permanently empty. This fakes the MEASURED body
 * and asserts one mapped row, so a shape regression cannot hide behind a mocked hook.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useShiftEligibleCandidates } from './useShiftStaffing'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
import api from '@/lib/api'
const mockGet = vi.mocked(api.get)
afterEach(() => vi.clearAllMocks())

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
)

describe('useShiftEligibleCandidates', () => {
  it('maps the measured {data: [row]} body into one eligible candidate', async () => {
    mockGet.mockResolvedValue({ data: { data: [
      { id: 'c1', first_name: 'Anna', last_name: 'Jansen', favourite: 1, reason: 'available' },
    ] } })
    const { result } = renderHook(() => useShiftEligibleCandidates('shift-1'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockGet).toHaveBeenCalledWith('/planning/shifts/shift-1/candidates', expect.anything())
    expect(result.current.candidates).toEqual([{ id: 'c1', firstName: 'Anna', lastName: 'Jansen', favourite: true, reason: 'available' }])
  })

  it('fetches nothing without a shift', () => {
    const { result } = renderHook(() => useShiftEligibleCandidates(null), { wrapper })
    expect(result.current.candidates).toEqual([])
    expect(mockGet).not.toHaveBeenCalled()
  })
})
