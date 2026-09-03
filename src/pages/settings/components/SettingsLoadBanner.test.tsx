/**
 * SettingsLoadBanner — SETTINGS-LOAD-ERROR-1. Asserts the three
 * useSettingsLoadState() states render correctly: silent while loading, silent
 * once loaded, and the ErrorBanner + working retry call once the GET has failed.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import SettingsLoadBanner from './SettingsLoadBanner'

// The hook under test's own state is stubbed per test — SettingsLoadBanner is a thin
// render of it, so this isolates the banner's own rendering/retry-wiring logic.
const stateRef = vi.hoisted(() => ({ current: 'loading' as 'loading' | 'loaded' | 'failed' }))
const retryMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/settings/useAllSettings', () => ({
  useSettingsLoadState: () => ({ state: stateRef.current, retry: retryMock }),
}))

describe('SettingsLoadBanner', () => {
  it('renders nothing while the settings blob is still loading when no fallback is provided', () => {
    stateRef.current = 'loading'
    render(<SettingsLoadBanner />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders the loadingFallback while the settings blob is still loading', () => {
    stateRef.current = 'loading'
    render(<SettingsLoadBanner loadingFallback={<div>Loading settings...</div>} />)
    expect(screen.getByText('Loading settings...')).toBeInTheDocument()
  })

  it('renders nothing once the settings blob has loaded', () => {
    stateRef.current = 'loaded'
    render(<SettingsLoadBanner />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the error banner (not the fallback) when the GET has failed', () => {
    stateRef.current = 'failed'
    render(<SettingsLoadBanner loadingFallback={<div>Loading settings...</div>} />)
    expect(screen.queryByText('Loading settings...')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows the error banner with a working retry once the GET has failed', async () => {
    stateRef.current = 'failed'
    render(<SettingsLoadBanner />)
    const banner = screen.getByRole('alert')
    expect(banner).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: i18n.t('error.retry', { ns: 'common' }) }))
    expect(retryMock).toHaveBeenCalledTimes(1)
  })
})
