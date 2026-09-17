/**
 * useFieldInventory — asserts the GET request route + `entity` param, and the honest
 * error state on a rejected request (VERPLICHTE-VELDEN-INVENTARIS-1).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useFieldInventory } from './useFieldInventory'
import api from '@/lib/api'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

// Fresh QueryClient per render — no cross-test cache bleed, no retries slowing failures.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const mockedGet = vi.mocked(api.get)

describe('useFieldInventory', () => {
  it('requests GET /settings/field-inventory with the entity param', async () => {
    mockedGet.mockResolvedValue({ data: { data: { entity: 'candidate', groups: [], fields: [] } } })
    const { result } = renderHook(() => useFieldInventory('candidate'), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(api.get).toHaveBeenCalledWith('/settings/field-inventory', { params: { entity: 'candidate' } })
  })

  it('exposes groups and fields from the response', async () => {
    mockedGet.mockResolvedValue({ data: { data: {
      entity: 'candidate',
      groups: [{ key: 'personal', label_key: 'candidates:modal.fields.cardPersonal' }],
      fields: [{
        key: 'first_name', group: 'personal', type: 'string', requirable: true, creatable: true,
        writable: true, internal_name: 'first_name', external_name: 'first_name', aliases: [],
        requires_permission: null, reason: null,
      }],
    } } })
    const { result } = renderHook(() => useFieldInventory('candidate'), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.groups).toEqual([{ key: 'personal', label_key: 'candidates:modal.fields.cardPersonal' }])
    expect(result.current.fields[0].key).toBe('first_name')
  })

  it('renders an honest error state on a rejected request', async () => {
    mockedGet.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useFieldInventory('customer'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.fields).toEqual([])
  })
})
