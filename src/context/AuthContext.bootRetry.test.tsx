/**
 * AUTH-BOOT-TRANSIENT-1: the startup /auth/me probe. A transient failure (network error, 5xx) is retried and the
 * session survives; an auth verdict (401) ends on "no user" after exactly one request and wipes the device caches;
 * spent retries fall back to "no user" without the wipe. The requests are counted on the seam (REQUEST-ASSERT-1).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { clearDeviceCaches } from '@/lib/deviceCaches'
import { AuthProvider, useAuth } from './AuthContext'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, primeCsrf: vi.fn(async () => undefined), default: { get: vi.fn(), post: vi.fn(async () => ({ data: {} })) } }
})
vi.mock('@/lib/deviceCaches', async () => {
  const actual = await vi.importActual('@/lib/deviceCaches')
  return { ...actual, clearDeviceCaches: vi.fn() }
})
// Zero backoff in the test; the policy itself is covered by authBootProbe.test.
vi.mock('./authBootProbe', async () => {
  const actual = await vi.importActual('./authBootProbe')
  return { ...actual, BOOT_PROBE_DELAYS_MS: [0, 0, 0] }
})

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>
const me = { data: { user: { id: 'u1', roles: [{ name: 'recruiter', dashboard_type: 'recruitment' }] } } }
const networkError = () => Object.assign(new Error('Network Error'), { response: undefined })
const status = (code: number) => Object.assign(new Error(`HTTP ${code}`), { response: { status: code } })
const meCalls = () => vi.mocked(api.get).mock.calls.filter(c => c[0] === '/auth/me').length

afterEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('AuthContext · boot probe retry', () => {
  it('keeps the session when the first probe fails on a network error and the retry succeeds', async () => {
    localStorage.setItem('km_session', '1')
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url !== '/auth/me') return Promise.reject(new Error(`unexpected GET ${url}`))
      return meCalls() === 1 ? Promise.reject(networkError()) : Promise.resolve(me)
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current?.loading).toBe(false))
    expect(result.current?.user?.id).toBe('u1')
    expect(meCalls()).toBe(2)
    // The probe carries its own short timeout (the retry ceiling on a hanging backend).
    expect(api.get).toHaveBeenCalledWith('/auth/me', expect.objectContaining({ timeout: 8000 }))
    expect(clearDeviceCaches).not.toHaveBeenCalled()
  })

  it('ends on no user after exactly one request on a 401 and wipes the device caches', async () => {
    localStorage.setItem('km_session', '1')
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/auth/me' ? Promise.reject(status(401)) : Promise.reject(new Error(`unexpected GET ${url}`)))

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current?.loading).toBe(false))
    expect(result.current?.user).toBeNull()
    expect(meCalls()).toBe(1)
    expect(clearDeviceCaches).toHaveBeenCalledTimes(1)
  })

  it('falls back to no user after the retries are spent on a 503, without wiping the device caches', async () => {
    localStorage.setItem('km_session', '1')
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/auth/me' ? Promise.reject(status(503)) : Promise.reject(new Error(`unexpected GET ${url}`)))

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current?.loading).toBe(false))
    expect(result.current?.user).toBeNull()
    expect(meCalls()).toBe(4)
    expect(clearDeviceCaches).not.toHaveBeenCalled()
  })
})
