/**
 * resolveNotificationHref — the zip-ready notification's click-through is an
 * EXTERNAL signed URL (TRANSFER-FAMILIES ZIP), resolved separately from the
 * {page,id} record model. Pins: only http(s) passes, unknown types stay null.
 */
import { describe, it, expect } from 'vitest'
import { resolveNotificationHref } from './notificationTarget'
import type { AppNotification } from '@/hooks/useNotifications'

const row = (type: string, meta: Record<string, unknown>): AppNotification =>
  ({ id: 1, type, meta } as unknown as AppNotification)

describe('resolveNotificationHref', () => {
  it('resolves documents.zip_ready to its signed download URL', () => {
    expect(resolveNotificationHref(row('documents.zip_ready', { download_url: 'https://api.test/dl/abc?sig=x' })))
      .toBe('https://api.test/dl/abc?sig=x')
  })

  it('refuses a non-http scheme and a missing url', () => {
    expect(resolveNotificationHref(row('documents.zip_ready', { download_url: 'javascript:alert(1)' }))).toBeNull()
    expect(resolveNotificationHref(row('documents.zip_ready', {}))).toBeNull()
  })

  it('stays null for every other notification type', () => {
    expect(resolveNotificationHref(row('opportunity.won', { download_url: 'https://x.test/y' }))).toBeNull()
  })
})
