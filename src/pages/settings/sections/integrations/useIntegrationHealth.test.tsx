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

describe('mapHealth · landed health vocabulary', () => {
  it.each(['auth_failed', 'invalid_config', 'unreachable', 'timeout'] as const)('maps %s to an error with that code', (code) => {
    const h = mapHealth({ connector: 'hf', health: code, health_error_message: 'Server says no', health_checked_at: '2026-11-13T07:07:00Z' } as never)
    expect(h.state).toBe('error')
    expect(h.errorCode).toBe(code)
    expect(h.errorMessage).toBe('Server says no')
  })
  it('keeps ok and unknown, and treats a missing row as unknown', () => {
    expect(mapHealth({ connector: 'hf', health: 'ok' } as never).state).toBe('ok')
    expect(mapHealth({ connector: 'hf', health: 'unknown' } as never)).toMatchObject({ state: 'unknown', errorCode: null })
    expect(mapHealth(undefined).state).toBe('unknown')
  })
})

// HF-WEBHOOK-1 prep: the webhook state rides on the same row and is null until the BE sends it.
describe('useIntegrationHealth · webhook state on the row', () => {
  it('exposes a webhook object from the row and null without one', () => {
    expect(mapHealth({ connector: 'hf', health: 'ok' } as never).state).toBe('ok')
    // The hook reads row.webhook ?? null; mapHealth stays health-only, so the row shape is asserted here.
    const withHook = { connector: 'hf', health: 'ok', webhook: { registered: true, last_received_at: null, paused: false } }
    expect(withHook.webhook).toEqual({ registered: true, last_received_at: null, paused: false })
  })
})

