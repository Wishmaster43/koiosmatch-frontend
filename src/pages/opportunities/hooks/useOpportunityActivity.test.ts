/**
 * useOpportunityActivity — regression coverage for the blueprint-7 audit residue
 * ("changelog-route bestaat niet"). The backend worklist now confirms
 * GET /opportunities/{id}/activity is live (tenant- and permission-tested), so this
 * asserts the exact REQUEST (§13) the hook fires — the seam a green unit test could
 * otherwise miss entirely if the route string ever drifts (e.g. back to a plural
 * mismatch or a different sub-path).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useOpportunityActivity } from './useOpportunityActivity'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

import api from '@/lib/api'

const mockedGet = vi.mocked(api.get)

beforeEach(() => { vi.clearAllMocks() })

describe('useOpportunityActivity', () => {
  it('GETs /opportunities/{id}/activity with an abort signal', async () => {
    mockedGet.mockResolvedValue({ data: [] })
    const { result } = renderHook(() => useOpportunityActivity('o1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockedGet).toHaveBeenCalledWith('/opportunities/o1/activity', { signal: expect.any(AbortSignal) })
    expect(result.current.error).toBe(false)
  })

  it('maps the response rows into items', async () => {
    mockedGet.mockResolvedValue({ data: [{ id: 'e1', causer_name: 'Jan', description: 'Fase gewijzigd' }] })
    const { result } = renderHook(() => useOpportunityActivity('o1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.items).toEqual([{ id: 'e1', causer_name: 'Jan', description: 'Fase gewijzigd' }])
  })

  it('treats a 404 (endpoint not built yet) as a calm empty state, never an error', async () => {
    mockedGet.mockRejectedValue({ response: { status: 404 } })
    const { result } = renderHook(() => useOpportunityActivity('o1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.items).toEqual([])
    expect(result.current.error).toBe(false)
  })

  it('surfaces a real error for any non-404 failure', async () => {
    mockedGet.mockRejectedValue({ response: { status: 500 } })
    const { result } = renderHook(() => useOpportunityActivity('o1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe(true)
  })

  it('is a no-op with no id — never fetches without a target', () => {
    const { result } = renderHook(() => useOpportunityActivity(undefined))
    expect(mockedGet).not.toHaveBeenCalled()
    expect(result.current.items).toEqual([])
  })
})
