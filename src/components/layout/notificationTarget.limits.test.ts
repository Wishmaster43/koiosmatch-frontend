/**
 * notificationTarget — LIMIET-MONITOR-1: a `connector.limit_warning` row resolves
 * to a settings deep link (tenant limits tab or the super-admin platform limits
 * section) and navigates through the hash, since settings screens carry no
 * `?open=<id>` drawer.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolveNotificationTarget, navigateToNotificationTarget, buildNotificationDeepLink } from './notificationTarget'
import type { AppNotification } from '@/hooks/useNotifications'

const row = (meta: Record<string, unknown>): AppNotification =>
  ({ id: 1, type: 'connector.limit_warning', meta } as unknown as AppNotification)

afterEach(() => { vi.restoreAllMocks(); window.location.hash = '' })

describe('resolveNotificationTarget — connector.limit_warning', () => {
  it('tenant scope opens the integrations limits tab', () => {
    expect(resolveNotificationTarget(row({ connector: 'ai', scope: 'tenant', percent: 80, level: 80 })))
      .toEqual({ page: 'settings', id: 'limits', hash: '#settings/integrations/limits' })
  })

  it('platform scope opens the super-admin platform limits section', () => {
    expect(resolveNotificationTarget(row({ connector: 'opencage', scope: 'platform', percent: 100, level: 100 })))
      .toEqual({ page: 'settings', id: 'admin_limits', hash: '#settings/superadmin/admin_limits' })
  })

  it('an unknown scope resolves to nothing (the row stays a plain notice)', () => {
    expect(resolveNotificationTarget(row({ connector: 'ai' }))).toBeNull()
  })
})

// LIMITS-FE-F7: a real refusal/queue today (limits:check 'blocked' level) —
// two distinct notification types, each pointing at its own limits screen.
describe('resolveNotificationTarget — connector.limit_blocked / connector.limit_blocked_platform', () => {
  const blockedRow = (meta: Record<string, unknown>): AppNotification =>
    ({ id: 2, type: 'connector.limit_blocked', meta } as unknown as AppNotification)
  const blockedPlatformRow = (meta: Record<string, unknown>): AppNotification =>
    ({ id: 3, type: 'connector.limit_blocked_platform', meta } as unknown as AppNotification)

  it('connector.limit_blocked (tenant-facing) opens the integrations limits tab', () => {
    expect(resolveNotificationTarget(blockedRow({ connector: 'sm' })))
      .toEqual({ page: 'settings', id: 'limits', hash: '#settings/integrations/limits' })
  })

  it('connector.limit_blocked_platform (super-admin-facing) opens the platform limits section', () => {
    expect(resolveNotificationTarget(blockedPlatformRow({ connector: 'sm' })))
      .toEqual({ page: 'settings', id: 'admin_limits', hash: '#settings/superadmin/admin_limits' })
  })
})

describe('navigateToNotificationTarget — hash targets', () => {
  it('sets the hash and re-dispatches hashchange instead of the ?open= drawer route', () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent')
    navigateToNotificationTarget({ page: 'settings', id: 'limits', hash: '#settings/integrations/limits' })
    expect(window.location.hash).toBe('#settings/integrations/limits')
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'hashchange' }))
  })

  it('the new-tab deep link carries the same hash', () => {
    expect(buildNotificationDeepLink({ page: 'settings', id: 'limits', hash: '#settings/integrations/limits' }))
      .toBe(`${window.location.pathname}#settings/integrations/limits`)
  })
})
