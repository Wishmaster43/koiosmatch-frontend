/**
 * CompanySettings — "Career site active" opt-in toggle (§13: assert the REQUEST
 * payload, never only that a callback fired). The component itself does NOT
 * stringify booleans — that happens one layer down in settingsApi.js, which is
 * mocked out here — so the save assertion expects a real boolean.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { loadSettings, saveSettings } from '../lib/settingsApi'
import CompanySettings from './CompanySettings'

vi.mock('../lib/settingsApi', () => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
}))

const t = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

describe('CompanySettings — career site toggle', () => {
  it('renders unchecked by default when the setting is absent', async () => {
    loadSettings.mockResolvedValue({})
    saveSettings.mockResolvedValue(undefined)
    render(<CompanySettings />)

    const checkbox = await screen.findByRole('checkbox', { name: t('company.careerSiteOff') })
    expect(checkbox).not.toBeChecked()
  })

  it.each(['true', '1', 1])('reflects checked when loadSettings resolves career_site_active=%p', async (stored) => {
    loadSettings.mockResolvedValue({ career_site_active: stored })
    saveSettings.mockResolvedValue(undefined)
    render(<CompanySettings />)

    const checkbox = await screen.findByRole('checkbox', { name: t('company.careerSiteOn') })
    expect(checkbox).toBeChecked()
  })

  it('checking the toggle then saving posts career_site_active: true as a real boolean', async () => {
    loadSettings.mockResolvedValue({})
    saveSettings.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<CompanySettings />)

    const checkbox = await screen.findByRole('checkbox', { name: t('company.careerSiteOff') })
    await user.click(checkbox)
    await user.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(saveSettings).toHaveBeenCalled())
    const payload = saveSettings.mock.calls[0][0]
    expect(payload.career_site_active).toBe(true)
  })
})

// Audit finding (HIGH): the banner "upload" used to persist a session-local
// blob: URL as company_banner_url — dead after reload/for another user. No real
// upload endpoint exists for the banner (unlike the logo's /settings/logo), so
// this is now an honest gate: the upload button stays disabled and a blob: URL
// is never sent in the save payload, even if one lingers from before the fix.
describe('CompanySettings — banner upload honest gate', () => {
  it('renders the upload button disabled with a calm unavailable notice', async () => {
    loadSettings.mockResolvedValue({})
    saveSettings.mockResolvedValue(undefined)
    render(<CompanySettings />)

    const uploadBtn = await screen.findByRole('button', { name: t('common.upload') })
    expect(uploadBtn).toBeDisabled()
    expect(screen.getAllByText(t('company.bannerUploadUnavailable')).length).toBeGreaterThan(0)
  })

  it('never renders or re-persists a legacy blob: URL loaded from settings', async () => {
    loadSettings.mockResolvedValue({ company_banner_url: 'blob:http://localhost/legacy-broken' })
    saveSettings.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<CompanySettings />)

    // A stale blob: URL is dead in every tab but the one that created it — it
    // must not be shown as if it were a valid stored banner.
    await screen.findByRole('button', { name: t('common.upload') })
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(saveSettings).toHaveBeenCalled())
    const payload = saveSettings.mock.calls[0][0]
    expect(payload.company_banner_url).toBeUndefined()
  })
})
