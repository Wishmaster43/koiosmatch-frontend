/**
 * pushSubscription — proves the REAL request shapes on the P11-FASE5 contract
 * (§13): GET /push/vapid-key before subscribing, the exact POST body on
 * subscribe, and the exact DELETE body on unsubscribe. Mocks
 * navigator.serviceWorker / PushManager / Notification since jsdom has neither.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from './api'
import { isSupported, subscribe, unsubscribe, isSubscribed } from './pushSubscription'

vi.mock('./api', async () => {
  const actual = await vi.importActual('./api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})

// Fake PushSubscription with a stable endpoint + keys, matching what the
// browser's PushManager.subscribe() resolves to.
const fakeSubscription = {
  toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'p256dh-key', auth: 'auth-key' } }),
  unsubscribe: vi.fn().mockResolvedValue(true),
}

function installBrowserMocks({ permission = 'granted' as NotificationPermission } = {}) {
  const subscribeMock = vi.fn().mockResolvedValue(fakeSubscription)
  const getSubscriptionMock = vi.fn().mockResolvedValue(fakeSubscription)
  const registration = { pushManager: { subscribe: subscribeMock, getSubscription: getSubscriptionMock } }

  vi.stubGlobal('navigator', {
    serviceWorker: {
      register: vi.fn().mockResolvedValue(registration),
      getRegistration: vi.fn().mockResolvedValue(registration),
    },
  })
  vi.stubGlobal('PushManager', function () {})
  vi.stubGlobal('Notification', {
    permission,
    requestPermission: vi.fn().mockResolvedValue(permission),
  })
  return { subscribeMock, getSubscriptionMock }
}

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('pushSubscription', () => {
  it('isSupported is false when serviceWorker/PushManager/Notification are missing', () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('PushManager', undefined)
    vi.stubGlobal('Notification', undefined)
    expect(isSupported()).toBe(false)
  })

  it('subscribe(): fetches the vapid key, subscribes, and POSTs the exact body', async () => {
    installBrowserMocks()
    vi.mocked(api.get).mockResolvedValue({ data: { key: 'QUFBQUFBQUFBQUFB' } })
    vi.mocked(api.post).mockResolvedValue({ data: {} })

    await subscribe()

    expect(api.get).toHaveBeenCalledWith('/push/vapid-key')
    expect(api.post).toHaveBeenCalledWith('/push/subscriptions', {
      endpoint: 'https://push.example/abc',
      keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
    })
  })

  it('subscribe(): throws and never POSTs when permission is denied', async () => {
    installBrowserMocks({ permission: 'denied' })
    await expect(subscribe()).rejects.toThrow('push_permission_denied')
    expect(api.post).not.toHaveBeenCalled()
  })

  it('unsubscribe(): unsubscribes the browser subscription and DELETEs the exact body', async () => {
    installBrowserMocks()
    vi.mocked(api.delete).mockResolvedValue({ data: {} })

    await unsubscribe()

    expect(fakeSubscription.unsubscribe).toHaveBeenCalled()
    expect(api.delete).toHaveBeenCalledWith('/push/subscriptions', { data: { endpoint: 'https://push.example/abc' } })
  })

  it('unsubscribe(): no-op (no DELETE) when there is no active subscription', async () => {
    const { getSubscriptionMock } = installBrowserMocks()
    getSubscriptionMock.mockResolvedValue(undefined)

    await unsubscribe()

    expect(api.delete).not.toHaveBeenCalled()
  })

  it('isSubscribed(): reflects whether the browser holds a subscription', async () => {
    installBrowserMocks()
    await expect(isSubscribed()).resolves.toBe(true)
  })
})
