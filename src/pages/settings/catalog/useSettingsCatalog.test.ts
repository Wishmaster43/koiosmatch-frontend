/**
 * useSettingsCatalog — GET route through the API client, section unwrap, alias map,
 * and the error phase.
 */
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import api from '@/lib/api'
import { useSettingsCatalog } from './useSettingsCatalog'
import { catalogFixture } from './catalogFixture'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }))

// Fresh QueryClient per test so a cached catalogue never leaks between cases.
function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client }, children)
}

describe('useSettingsCatalog', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('loads GET /settings/catalog through the API client and unwraps the sections', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: catalogFixture })
    const { result } = renderHook(() => useSettingsCatalog(), { wrapper })
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(api.get).toHaveBeenCalledWith('/settings/catalog')
    expect(result.current.sections.map(s => s.id)).toEqual(['windows', 'retention', 'messaging', 'email', 'kpi'])
    expect(result.current.version).toBe('2026-09-09')
  })

  it('builds the alias → canonical key map from every row', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: catalogFixture })
    const { result } = renderHook(() => useSettingsCatalog(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.aliasToCanonical).toEqual({ notif_kandidaten: 'notifications_candidates_enabled' })
  })

  it('reports the error phase on a rejected GET', async () => {
    vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 404 } })
    const { result } = renderHook(() => useSettingsCatalog(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.sections).toEqual([])
  })
})
