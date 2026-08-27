/**
 * SETTINGS-GUARD-HASH-1 — a dirty section must not silently lose its unsaved
 * changes when the user clicks a #settings/... deep link elsewhere on the page.
 * Covers: dirty + hashchange → confirm appears; cancel restores the OLD hash;
 * confirm navigates to the NEW location. Heavy registry/auth/apps deps are
 * mocked down to two minimal nav groups so this stays a shell-only test.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useContext } from 'react'
import SettingsPage from './SettingsPage'
import { SettingsDirtyContext } from './lib/settingsDirty'

// Two visible groups/tabs — the second tab's body reports itself dirty via the
// shared SettingsDirtyContext, mirroring how a real migrated section behaves.
function DirtySection() {
  const ctx = useContext(SettingsDirtyContext)
  return <button onClick={() => ctx.report(true)}>make-dirty</button>
}

vi.mock('./registry', () => ({
  NAV_GROUPS: [
    { key: 'general', icon: null, items: [{ id: 'tab_a', render: () => <div>tab-a-body</div> }] },
    { key: 'other', icon: null, items: [{ id: 'tab_b', render: () => <DirtySection /> }] },
  ],
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isSuperAdmin: () => true,
    hasModule: () => true,
    hasPermission: () => true,
  }),
}))

vi.mock('@/context/AppsContext', () => ({
  useApps: () => ({ isAppEnabled: () => true }),
}))

afterEach(() => {
  window.location.hash = ''
  vi.clearAllMocks()
})

describe('SettingsPage — hashchange dirty-guard', () => {
  it('dirty + hashchange shows the unsaved-changes confirm', async () => {
    render(<SettingsPage />)
    // Land on tab_b (general/tab_a is the default first tab; navigate via a real hashchange).
    act(() => { window.location.hash = '#settings/other/tab_b'; window.dispatchEvent(new HashChangeEvent('hashchange')) })
    await waitFor(() => expect(screen.getByText('make-dirty')).toBeInTheDocument())
    fireEvent.click(screen.getByText('make-dirty'))

    // Simulate the browser having already applied a new hash before the handler runs.
    act(() => { window.location.hash = '#settings/general/tab_a'; window.dispatchEvent(new HashChangeEvent('hashchange')) })

    expect(await screen.findByText('Je hebt niet-opgeslagen wijzigingen. Wil je deze sectie verlaten?')).toBeInTheDocument()
  })

  it('cancel restores the old hash and keeps the dirty tab open', async () => {
    render(<SettingsPage />)
    act(() => { window.location.hash = '#settings/other/tab_b'; window.dispatchEvent(new HashChangeEvent('hashchange')) })
    await waitFor(() => expect(screen.getByText('make-dirty')).toBeInTheDocument())
    fireEvent.click(screen.getByText('make-dirty'))

    act(() => { window.location.hash = '#settings/general/tab_a'; window.dispatchEvent(new HashChangeEvent('hashchange')) })
    await screen.findByText('Je hebt niet-opgeslagen wijzigingen. Wil je deze sectie verlaten?')

    fireEvent.click(screen.getByText('Annuleren'))

    await waitFor(() => expect(window.location.hash).toBe('#settings/other/tab_b'))
    expect(screen.getByText('make-dirty')).toBeInTheDocument()
  })

  it('confirm navigates to the new location and clears the dirty flag', async () => {
    render(<SettingsPage />)
    act(() => { window.location.hash = '#settings/other/tab_b'; window.dispatchEvent(new HashChangeEvent('hashchange')) })
    await waitFor(() => expect(screen.getByText('make-dirty')).toBeInTheDocument())
    fireEvent.click(screen.getByText('make-dirty'))

    act(() => { window.location.hash = '#settings/general/tab_a'; window.dispatchEvent(new HashChangeEvent('hashchange')) })
    await screen.findByText('Je hebt niet-opgeslagen wijzigingen. Wil je deze sectie verlaten?')

    fireEvent.click(screen.getByText('Bevestigen'))

    await waitFor(() => expect(screen.getByText('tab-a-body')).toBeInTheDocument())
    await waitFor(() => expect(window.location.hash).toBe('#settings/general/tab_a'))
  })
})
