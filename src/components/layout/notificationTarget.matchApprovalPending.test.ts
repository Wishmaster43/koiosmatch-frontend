/**
 * resolveNotificationTarget — MATCH-APPROVAL-2: a match pending approval
 * notification (meta: { match_id, task_id }) resolves to the match drawer
 * with intent { pendingApprovalOnly: true } to activate the approval queue
 * quick view on arrival.
 */
import { describe, it, expect } from 'vitest'
import { resolveNotificationTarget } from './notificationTarget'
import type { AppNotification } from '@/hooks/useNotifications'

const row = (type: string, meta: Record<string, unknown>): AppNotification =>
  ({ id: 1, type, meta } as unknown as AppNotification)

describe('resolveNotificationTarget — match.approval_pending', () => {
  it('resolves to the match with pendingApprovalOnly intent', () => {
    expect(resolveNotificationTarget(row('match.approval_pending', { match_id: 'm-42', task_id: 't-7 ' })))
      .toEqual({ page: 'matches', id: 'm-42', intent: { pendingApprovalOnly: true } })
  })

  it('returns null when match_id is missing', () => {
    expect(resolveNotificationTarget(row('match.approval_pending', { task_id: 't-7' }))).toBeNull()
  })

  it('coerces match_id to a string', () => {
    expect(resolveNotificationTarget(row('match.approval_pending', { match_id: 42 })))
      .toEqual({ page: 'matches', id: '42', intent: { pendingApprovalOnly: true } })
  })
})
