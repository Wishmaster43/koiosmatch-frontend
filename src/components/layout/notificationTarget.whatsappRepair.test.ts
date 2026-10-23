/**
 * notificationTarget: a `whatsapp_web.repair_required` row opens the WhatsApp Web
 * devices settings tab (meta carries device_ids only, no entity pointer).
 */
import { describe, it, expect } from 'vitest'
import { resolveNotificationTarget } from './notificationTarget'
import type { AppNotification } from '@/hooks/useNotifications'

const row = (meta: Record<string, unknown>): AppNotification =>
  ({ id: 1, type: 'whatsapp_web.repair_required', meta } as unknown as AppNotification)

describe('resolveNotificationTarget: whatsapp_web.repair_required', () => {
  it('deep-links to the WhatsApp Web devices tab', () => {
    expect(resolveNotificationTarget(row({ device_ids: ['d1'] })))
      .toEqual({ page: 'settings', id: 'whatsapp_web', hash: '#settings/communication/whatsapp_web' })
  })
})
