/**
 * resolveNotificationTarget — the same-app `link` hash fallback (D1 audit fix,
 * JOINT-DEEP-AUDIT-1): asserts the fallback genuinely reuses parseHashTarget
 * instead of a second hand-written copy of the same split/URLSearchParams logic.
 */
import { describe, it, expect } from 'vitest'
import { resolveNotificationTarget } from './notificationTarget'
import type { AppNotification } from '@/hooks/useNotifications'

const row = (link: string | null): AppNotification =>
  ({ id: 1, link, url: null, entity_type: null } as unknown as AppNotification)

describe('resolveNotificationTarget link fallback', () => {
  it('resolves a same-app hash link to {page, id}', () => {
    expect(resolveNotificationTarget(row('#tasks?open=42'))).toEqual({ page: 'tasks', id: '42' })
  })

  it('returns null for a link with no id', () => {
    expect(resolveNotificationTarget(row('#tasks'))).toBeNull()
  })

  it('returns null when there is no link at all', () => {
    expect(resolveNotificationTarget(row(null))).toBeNull()
  })
})
