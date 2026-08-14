/**
 * Regression test for the "Maximum update depth exceeded" crash the smoke suite
 * caught on the real Reports page (14-08) while every unit test stayed green.
 *
 * The cause was one character: `return data ?? []`. That hands the caller a NEW
 * array identity on every render while the query is disabled or still loading.
 * The reports right panel feeds these options into a memo that an effect
 * registers, so a new identity meant register → context state → re-render →
 * register, until React gave up. The candidate drawer's match form calls the same
 * hook, which is why two unrelated screens broke at once.
 *
 * Every unit test missed it because they all mock this hook with a stable
 * reference. So the thing to pin is the hook's OWN contract: the same reference,
 * every render, until real data arrives.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useCustomerOptions } from './useCustomerOptions'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })) } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

beforeEach(() => vi.clearAllMocks())

describe('useCustomerOptions', () => {
  it('returns the SAME empty reference across renders while disabled — the identity that caused the render loop', () => {
    const { result, rerender } = renderHook(() => useCustomerOptions(false), { wrapper })
    const first = result.current
    rerender()
    rerender()
    expect(result.current).toBe(first)
    expect(api.get).not.toHaveBeenCalled()
  })

  it('keeps that stable reference while the enabled query is still loading', () => {
    const { result, rerender } = renderHook(() => useCustomerOptions(true), { wrapper })
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  it('fetches a capped page and maps rows to {value,label} once enabled', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [{ id: 'c1', name: 'Zorggroep Noord' }] } } as never)
    const { result } = renderHook(() => useCustomerOptions(true), { wrapper })
    await waitFor(() => expect(result.current.length).toBe(1))
    const [url, config] = vi.mocked(api.get).mock.calls[0]
    expect(url).toBe('/customers')
    expect(config?.params).toEqual({ per_page: 100 })
    expect(result.current[0]).toEqual({ value: 'c1', label: 'Zorggroep Noord' })
  })
})
