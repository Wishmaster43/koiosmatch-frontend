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
