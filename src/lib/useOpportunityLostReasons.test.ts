/**
 * useOpportunityLostReasons — GET route + empty-on-failure regression (OPP-LOST-FE-1).
 * Each test uses a dedicated tenant id so useCachedLookup's module-scope cache
 * never leaks a mapped result between tests (mirrors useApplicationSources.test.ts).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() }, getActiveTenantId: vi.fn() }
})

import api, { getActiveTenantId } from '@/lib/api'
import { useOpportunityLostReasons } from './useOpportunityLostReasons'
const mockedGet = vi.mocked(api.get)
const mockedTenantId = vi.mocked(getActiveTenantId)
let tenantSeq = 0
const nextTenant = () => `t${tenantSeq++}`

afterEach(() => vi.clearAllMocks())

describe('useOpportunityLostReasons', () => {
  it('fetches /opportunity-lost-reasons and maps name/color to value/label', async () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockResolvedValue({ data: { data: [{ id: 'r1', name: 'Budget' }] } })
    const { result } = renderHook(() => useOpportunityLostReasons())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockedGet).toHaveBeenCalledWith('/opportunity-lost-reasons', undefined)
    expect(result.current.reasons).toEqual([{ value: 'Budget', label: 'Budget', color: undefined }])
  })

  it('resolves to an empty list, never demo data, when the request fails', async () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useOpportunityLostReasons())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.reasons).toEqual([])
  })

  it('resolves to an empty list when the tenant has curated none yet', async () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockResolvedValue({ data: { data: [] } })
    const { result } = renderHook(() => useOpportunityLostReasons())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.reasons).toEqual([])
  })
})
