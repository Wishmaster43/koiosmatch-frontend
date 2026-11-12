/** useIntegrationHealth: GET /integrations once, per-connector mapping, absent fields = unknown, refresh refetches. */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useIntegrationHealth, mapHealth, HEALTH_REFETCH_MS } from './useIntegrationHealth'
import { getIntegrations } from './integrationsApi'

vi.mock('./integrationsApi', () => ({ getIntegrations: vi.fn() }))
const mockList = getIntegrations as unknown as ReturnType<typeof vi.fn>

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
const base = { enabled: true, configured: true, two_way: false, connected_as: null, last_sync_at: null }

afterEach(() => vi.clearAllMocks())

describe('useIntegrationHealth', () => {
  // Maps the error row of the asked connector and fetches the list exactly once.
  it('maps ok and error rows per connector with one request', async () => {
    mockList.mockResolvedValue([
      { ...base, connector: 'helloflex', health: 'error', health_error: 'auth_failed', health_error_message: 'Bad secret', health_checked_at: '2026-11-12T10:00:00Z' },
      { ...base, connector: 'shiftmanager', health: 'ok' },
    ])
    const hf = renderHook(() => useIntegrationHealth('helloflex'), { wrapper: wrapper() })
    await waitFor(() => expect(hf.result.current.health.state).toBe('error'))
    expect(hf.result.current.health).toEqual({ state: 'error', errorCode: 'auth_failed', errorMessage: 'Bad secret', checkedAt: '2026-11-12T10:00:00Z' })
    expect(mockList).toHaveBeenCalledTimes(1)
  })

  // Absent BE fields and a missing row both read as unknown.
  it('treats absent fields as unknown', () => {
    expect(mapHealth(undefined).state).toBe('unknown')
    expect(mapHealth({ ...base, connector: 'werkzoeken', health: 'unknown' })).toEqual({ state: 'unknown', errorCode: null, errorMessage: null, checkedAt: null })
    expect(HEALTH_REFETCH_MS).toBe(59 * 60_000)
  })

  // refresh() triggers a second GET /integrations.
  it('refresh refetches', async () => {
    mockList.mockResolvedValue([{ ...base, connector: 'helloflex', health: 'ok' }])
    const { result } = renderHook(() => useIntegrationHealth('helloflex'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.health.state).toBe('ok'))
    act(() => result.current.refresh())
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2))
  })
})
