/**
 * CREDITS-1 — the billing_usage settings item must gate on the `billing.view`
 * permission, not merely on settings.view. A regression here would silently
 * re-expose the credits/cost screen to every settings.view user (§3 — a screen
 * without the right must stay HIDDEN, never just disabled).
 */
import { describe, it, expect } from 'vitest'
import { NAV_GROUPS } from './registry'

describe('registry — billing_usage permission gate', () => {
  it('billing_usage declares requiresPermission: billing.view', () => {
    const billingGroup = NAV_GROUPS.find((g) => g.key === 'billing')
    const item = billingGroup?.items.find((i) => i.id === 'billing_usage')
    expect(item?.requiresPermission).toBe('billing.view')
  })
})
