/**
 * notificationTarget: the three facebook lead notification types deep-link
 * into the Facebook leads settings (queue tab or connection tab).
 */
import { describe, it, expect } from 'vitest'
import { resolveNotificationTarget } from './notificationTarget'
import type { AppNotification } from '@/hooks/useNotifications'

const row = (type: string): AppNotification =>
  ({ id: 1, type, meta: { count: 2, forms: ' Formulieren: 123, 456.' } } as unknown as AppNotification)

describe('resolveNotificationTarget: facebook lead types', () => {
  it.each(['facebook.lead_pending', 'facebook.lead_failed'])('%s opens the queue tab', (type) => {
    expect(resolveNotificationTarget(row(type))).toEqual({
      page: 'settings', id: 'facebook_leads', hash: '#settings/integrations/facebook_leads?view=queue',
    })
  })
  it('leads_retrieval_missing opens the connection tab', () => {
    expect(resolveNotificationTarget(row('facebook.leads_retrieval_missing'))).toEqual({
      page: 'settings', id: 'facebook_leads', hash: '#settings/integrations/facebook_leads',
    })
  })
})
