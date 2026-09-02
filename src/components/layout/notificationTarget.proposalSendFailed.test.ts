/**
 * resolveNotificationTarget — K-248 PROPOSE-SEND-1's `proposal.send_failed`
 * bell resolves to the application it belongs to via meta.application_id.
 */
import { describe, it, expect } from 'vitest'
import { resolveNotificationTarget } from './notificationTarget'
import type { AppNotification } from '@/hooks/useNotifications'

const row = (type: string, meta: Record<string, unknown>): AppNotification =>
  ({ id: 1, type, meta } as unknown as AppNotification)

describe('resolveNotificationTarget — proposal.send_failed', () => {
  it('resolves to the application via meta.application_id', () => {
    expect(resolveNotificationTarget(row('proposal.send_failed', { application_id: 42, proposal_id: 7 })))
      .toEqual({ page: 'applications', id: '42' })
  })

  it('returns null when application_id is missing', () => {
    expect(resolveNotificationTarget(row('proposal.send_failed', { proposal_id: 7 }))).toBeNull()
  })
})
