/**
 * Row 32 (Danny 09-09): a deep link to a settings slug that moved to the profile page
 * (MOVED_TO_PROFILE) hands the shell a profile navigation — and the settings page must
 * NOT overwrite the hash with its own first-tab fallback afterwards (screen-checked
 * 10-09: the profile rendered while the URL said #settings/action_rules/action_rules,
 * so a reload would have landed on the wrong screen).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import SettingsPage from './SettingsPage'
import { NavigationProvider } from '@/context/NavigationContext'

vi.mock('./registry', () => ({
  NAV_GROUPS: [
    { key: 'general', icon: null, items: [{ id: 'tab_a', render: () => <div>tab-a-body</div> }] },
  ],
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isSuperAdmin: () => true, hasModule: () => true, hasPermission: () => true }),
}))
vi.mock('@/context/AppsContext', () => ({ useApps: () => ({ isAppEnabled: () => true }) }))

afterEach(() => { window.location.hash = '' })

describe('SettingsPage — moved slug redirect', () => {
  it('navigates to the profile tab and leaves the hash alone', async () => {
    window.location.hash = '#settings/notifications/notif_my'
    const goTo = vi.fn()
    render(<NavigationProvider goTo={goTo}><SettingsPage /></NavigationProvider>)
    await waitFor(() => expect(goTo).toHaveBeenCalledWith('profile', { tab: 'notifications' }))
    // The first-tab fallback must not win the URL after the redirect.
    expect(window.location.hash).toBe('#settings/notifications/notif_my')
  })

  it('still syncs the hash for an ordinary unknown slug (fallback to the first tab)', async () => {
    window.location.hash = '#settings/nope/nothing'
    const goTo = vi.fn()
    render(<NavigationProvider goTo={goTo}><SettingsPage /></NavigationProvider>)
    await waitFor(() => expect(window.location.hash).toBe('#settings/general/tab_a'))
    expect(goTo).not.toHaveBeenCalled()
  })
})
