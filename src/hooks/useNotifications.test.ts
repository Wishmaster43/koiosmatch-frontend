/**
 * useNotifications — regression test for the poll tick-guard: an idle background tab
 * must not keep hitting GET /notifications. No test harness exists yet for this hook
 * (or NotificationBell), so the extracted pure predicate is covered directly.
 */
import { describe, it, expect } from 'vitest'
import { shouldPollNotifications } from './useNotifications'

describe('shouldPollNotifications', () => {
  it('allows a tick while the tab is visible', () => {
    expect(shouldPollNotifications('visible')).toBe(true)
  })

  it('skips a tick while the tab is hidden', () => {
    expect(shouldPollNotifications('hidden')).toBe(false)
  })
})
