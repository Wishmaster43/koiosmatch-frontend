/**
 * notificationTarget: a `kpi.below_target` row opens the dashboard
 * (meta carries kpi/metric/period/value/target, no entity pointer).
 */
import { describe, it, expect } from 'vitest'
import { resolveNotificationTarget } from './notificationTarget'
import type { AppNotification } from '@/hooks/useNotifications'

const row = (meta: Record<string, unknown>): AppNotification =>
  ({ id: 1, type: 'kpi.below_target', meta } as unknown as AppNotification)

describe('resolveNotificationTarget: kpi.below_target', () => {
  it('deep-links to the dashboard', () => {
    expect(resolveNotificationTarget(row({ kpi: 'placements_target', metric: 'placements', period: '2026-09', value: 3, target: 10 })))
      .toEqual({ page: 'dashboard', id: '', hash: '#dashboard' })
  })
})
