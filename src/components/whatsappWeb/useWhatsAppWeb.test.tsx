/**
 * useWhatsAppWeb — K-193 fase 1 contract coverage: the exact routes hit by each
 * action, the polling contract (3s only while a device is transient), and the
 * typed 501/403 handling (never a silent catch, never a raw error state for an
 * off module).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useWhatsAppWeb } from './useWhatsAppWeb'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

afterEach(() => vi.clearAllMocks())

// Fresh QueryClient per render — no cross-test cache bleed, no retries slowing failures.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useWhatsAppWeb', () => {
  it('loads the list from GET /profile/whatsapp-web', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 1, status: 'disconnected' }] } })
    const { result } = renderHook(() => useWhatsAppWeb(), { wrapper })

    await waitFor(() => expect(result.current.phase).toBe('ready'))

    expect(api.get).toHaveBeenCalledWith('/profile/whatsapp-web', expect.objectContaining({}))
    expect(result.current.devices).toHaveLength(1)
  })

  it('a 403/404 on the list degrades to the unavailable phase, not error', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 404 } })
    const { result } = renderHook(() => useWhatsAppWeb(), { wrapper })

    await waitFor(() => expect(result.current.phase).toBe('unavailable'))
  })

  it('a genuine failure (500) surfaces the error phase', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 500 } })
    const { result } = renderHook(() => useWhatsAppWeb(), { wrapper })

    await waitFor(() => expect(result.current.phase).toBe('error'))
  })

  it('connect() posts the exact route and refetches', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 7, status: 'disconnected' }] } })
    vi.mocked(api.post).mockResolvedValue({ data: { status: 'connecting' } })
    const { result } = renderHook(() => useWhatsAppWeb(), { wrapper })
    await waitFor(() => expect(result.current.phase).toBe('ready'))

    await act(async () => { await result.current.connect(7) })

    expect(api.post).toHaveBeenCalledWith('/profile/whatsapp-web/7/connect')
    // refetch runs after the mutation
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('connect() 501 surfaces as notEnabledId, never a silent catch', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 7, status: 'disconnected' }] } })
    vi.mocked(api.post).mockRejectedValue({ response: { status: 501 } })
    const { result } = renderHook(() => useWhatsAppWeb(), { wrapper })
    await waitFor(() => expect(result.current.phase).toBe('ready'))

    await act(async () => { await result.current.connect(7) })

    expect(result.current.notEnabledId).toBe(7)
  })

  it('disconnect() posts the exact route', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 3, status: 'connected' }] } })
    vi.mocked(api.post).mockResolvedValue({ data: { status: 'disconnected' } })
    const { result } = renderHook(() => useWhatsAppWeb(), { wrapper })
    await waitFor(() => expect(result.current.phase).toBe('ready'))

    await act(async () => { await result.current.disconnect(3) })

    expect(api.post).toHaveBeenCalledWith('/profile/whatsapp-web/3/disconnect')
  })

  it('remove() deletes the exact route', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 5, status: 'disconnected' }] } })
    vi.mocked(api.delete).mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useWhatsAppWeb(), { wrapper })
    await waitFor(() => expect(result.current.phase).toBe('ready'))

    await act(async () => { await result.current.remove(5) })

    expect(api.delete).toHaveBeenCalledWith('/profile/whatsapp-web/5')
  })

  it('createDevice() posts to the collection route', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    vi.mocked(api.post).mockResolvedValue({ data: { id: 9, status: 'disconnected' } })
    const { result } = renderHook(() => useWhatsAppWeb(), { wrapper })
    await waitFor(() => expect(result.current.phase).toBe('ready'))

    await act(async () => { await result.current.createDevice() })

    expect(api.post).toHaveBeenCalledWith('/profile/whatsapp-web')
  })

  it('polls every 3s only while a device is transient, then stops', async () => {
    vi.useFakeTimers()
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { data: [{ id: 1, status: 'qr_pending' }] } })
      .mockResolvedValueOnce({ data: { data: [{ id: 1, status: 'connected' }] } })
    renderHook(() => useWhatsAppWeb(), { wrapper })

    await vi.waitFor(() => expect(api.get).toHaveBeenCalledTimes(1))
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    await vi.waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))

    // Now settled ('connected'), a further 3s must NOT trigger another poll.
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    await vi.waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    vi.useRealTimers()
  })

  // K-195: the settings surface (branch devices) drives the SAME hook via basePath.
  describe('basePath = /settings/whatsapp-web-numbers (K-195 branch devices)', () => {
    it('loads the list from the settings route', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 2, status: 'disconnected' }] } })
      const { result } = renderHook(() => useWhatsAppWeb('/settings/whatsapp-web-numbers'), { wrapper })

      await waitFor(() => expect(result.current.phase).toBe('ready'))

      expect(api.get).toHaveBeenCalledWith('/settings/whatsapp-web-numbers', expect.objectContaining({}))
      expect(result.current.devices).toHaveLength(1)
    })

    it('createDevice(body) posts the location_id/label/phone_number body to the settings route', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
      vi.mocked(api.post).mockResolvedValue({ data: { id: 9, status: 'disconnected' } })
      const { result } = renderHook(() => useWhatsAppWeb('/settings/whatsapp-web-numbers'), { wrapper })
      await waitFor(() => expect(result.current.phase).toBe('ready'))

      await act(async () => {
        await result.current.createDevice({ location_id: 'loc-1', label: 'Branch A', phone_number: undefined })
      })

      expect(api.post).toHaveBeenCalledWith('/settings/whatsapp-web-numbers',
        { location_id: 'loc-1', label: 'Branch A', phone_number: undefined })
    })

    it('connect/disconnect/remove hit the settings-scoped routes', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 5, status: 'disconnected' }] } })
      vi.mocked(api.post).mockResolvedValue({ data: { status: 'connecting' } })
      vi.mocked(api.delete).mockResolvedValue({ data: {} })
      const { result } = renderHook(() => useWhatsAppWeb('/settings/whatsapp-web-numbers'), { wrapper })
      await waitFor(() => expect(result.current.phase).toBe('ready'))

      await act(async () => { await result.current.connect(5) })
      expect(api.post).toHaveBeenCalledWith('/settings/whatsapp-web-numbers/5/connect')

      await act(async () => { await result.current.disconnect(5) })
      expect(api.post).toHaveBeenCalledWith('/settings/whatsapp-web-numbers/5/disconnect')

      await act(async () => { await result.current.remove(5) })
      expect(api.delete).toHaveBeenCalledWith('/settings/whatsapp-web-numbers/5')
    })

    it('the two surfaces do not share a cache entry (distinct queryKey per basePath)', async () => {
      vi.mocked(api.get)
        .mockResolvedValueOnce({ data: { data: [{ id: 1, status: 'connected' }] } })
        .mockResolvedValueOnce({ data: { data: [{ id: 2, status: 'connected' }] } })
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const wrap = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>

      const profile = renderHook(() => useWhatsAppWeb(), { wrapper: wrap })
      const settings = renderHook(() => useWhatsAppWeb('/settings/whatsapp-web-numbers'), { wrapper: wrap })

      await waitFor(() => expect(profile.result.current.devices[0]?.id).toBe(1))
      await waitFor(() => expect(settings.result.current.devices[0]?.id).toBe(2))
      expect(api.get).toHaveBeenCalledTimes(2)
    })
  })
})
