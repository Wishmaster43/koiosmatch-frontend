/** useHelloflexWebhook: GET on mount (helloflex only), POST register, DELETE unregister, error message. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const { get, post, del, notify } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), del: vi.fn(), notify: vi.fn() }))
vi.mock('@/lib/api', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/api')>()
  return { ...actual, default: { get, post, delete: del } }
})
vi.mock('@/lib/notify', () => ({ notify }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import { useHelloflexWebhook } from './useHelloflexWebhook'

const STATUS = { registered: true, registration_id: 'r1', filters: [], last_received_at: null, verified_at: null }
const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  get.mockResolvedValue({ data: { data: STATUS } })
  post.mockResolvedValue({ data: { data: STATUS } })
  del.mockResolvedValue({ data: null })
})

describe('useHelloflexWebhook', () => {
  // GET fires for helloflex only.
  it('fetches the status on mount for helloflex and not for other connectors', async () => {
    const { result } = renderHook(() => useHelloflexWebhook('helloflex'), { wrapper })
    await waitFor(() => expect(result.current.status).toEqual(STATUS))
    expect(get).toHaveBeenCalledWith('/integrations/helloflex/webhook')
    get.mockClear()
    renderHook(() => useHelloflexWebhook('werkzoeken'), { wrapper })
    expect(get).not.toHaveBeenCalled()
  })

  // Register POSTs, refetches and calls onChanged.
  it('POSTs on register, then invalidates and calls onChanged', async () => {
    const onChanged = vi.fn()
    const { result } = renderHook(() => useHelloflexWebhook('helloflex', onChanged), { wrapper })
    await waitFor(() => expect(result.current.status).not.toBeNull())
    act(() => result.current.register({ rotate: false }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(post.mock.calls[0]).toEqual(['/integrations/helloflex/webhook', undefined, { quietStatuses: [409, 422], timeout: 120000 }])
    expect(notify).toHaveBeenCalledWith('success', 'integrations.webhook.registeredSuccess')
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
  })

  // Unregister DELETEs the same route.
  it('DELETEs on unregister', async () => {
    const onChanged = vi.fn()
    const { result } = renderHook(() => useHelloflexWebhook('helloflex', onChanged), { wrapper })
    await waitFor(() => expect(result.current.status).not.toBeNull())
    act(() => result.current.unregister())
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(del.mock.calls[0]).toEqual(['/integrations/helloflex/webhook', { quietStatuses: [409, 422], timeout: 120000 }])
    expect(notify).toHaveBeenCalledWith('success', 'integrations.webhook.unregisteredSuccess')
  })

  // The body message wins, the generic key is the fallback.
  it('shows the refusal message or the generic fallback', async () => {
    const { result } = renderHook(() => useHelloflexWebhook('helloflex'), { wrapper })
    await waitFor(() => expect(result.current.status).not.toBeNull())
    post.mockRejectedValueOnce({ response: { data: { ok: false, message: 'HTTPS is required' } } })
    act(() => result.current.register({ rotate: false }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('error', 'HTTPS is required'))
    del.mockRejectedValueOnce(new Error('boom'))
    act(() => result.current.unregister())
    await waitFor(() => expect(notify).toHaveBeenCalledWith('error', 'integrations.webhook.actionFailed'))
  })

  // Rotate uses its own toast wording.
  it('uses the rotated toast for a rotation', async () => {
    const { result } = renderHook(() => useHelloflexWebhook('helloflex'), { wrapper })
    await waitFor(() => expect(result.current.status).not.toBeNull())
    act(() => result.current.register({ rotate: true }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', 'integrations.webhook.rotatedSuccess'))
  })

  // busy is true while a mutation is pending.
  it('reports busy while a mutation is pending', async () => {
    let release: (v: unknown) => void = () => {}
    post.mockReturnValueOnce(new Promise((r) => { release = r }))
    const { result } = renderHook(() => useHelloflexWebhook('helloflex'), { wrapper })
    await waitFor(() => expect(result.current.status).not.toBeNull())
    act(() => result.current.register({ rotate: false }))
    await waitFor(() => expect(result.current.busy).toBe(true))
    release({ data: { data: STATUS } })
    await waitFor(() => expect(result.current.busy).toBe(false))
  })
})
