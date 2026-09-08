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
