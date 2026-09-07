/**
 * useWhatsAppWebHealth — the gateway verdict behind the two device surfaces:
 * configured/reachable straight from the health route, a permission-off
 * 403/404 means no banner, and a failing health route reads as unreachable.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useWhatsAppWebHealth } from './useWhatsAppWebHealth'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }))
afterEach(() => vi.clearAllMocks())

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useWhatsAppWebHealth', () => {
  it('reads configured/reachable from GET /whatsapp-web/health', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { gateway: { configured: true, reachable: true }, data: [] } })
    const { result } = renderHook(() => useWhatsAppWebHealth(), { wrapper })
    await waitFor(() => expect(result.current.gateway).not.toBeNull())
    expect(api.get).toHaveBeenCalledWith('/whatsapp-web/health', expect.objectContaining({}))
    expect(result.current.gatewayDown).toBe(false)
  })

  it('a configured gateway that does not answer is down', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { gateway: { configured: true, reachable: false }, data: [] } })
    const { result } = renderHook(() => useWhatsAppWebHealth(), { wrapper })
    await waitFor(() => expect(result.current.gatewayDown).toBe(true))
    expect(result.current.gateway).toEqual({ configured: true, reachable: false })
  })

  it('a 403/404 on the health route means no verdict (no banner)', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 403 } })
    const { result } = renderHook(() => useWhatsAppWebHealth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.gateway).toBeNull()
    expect(result.current.gatewayDown).toBe(false)
  })

  it('a failing health route reads as configured but unreachable', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 500 } })
    const { result } = renderHook(() => useWhatsAppWebHealth(), { wrapper })
    await waitFor(() => expect(result.current.gatewayDown).toBe(true))
  })
})
