/**
 * CustomerConversionSettings — mirrors CandidateConversionSettings for the
 * customer axis (Danny 2026-08-03: "Waar is deze bij klant?"). Unlike the
 * candidate screen, an ABSENT setting must show 'none' — the control always
 * reflects what actually happens today (no default applied), never a guessed
 * real status.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { CustomerConversionSettings, CONVERT_DEFAULT_STATUS_KEY } from './CustomerConversionSettings'

const st = key => i18n.t(key, { ns: 'settings' })

// Customer status lookup — plain values only; no requires_match/is_blacklist
// flags exist on this axis (§3B defines those for the candidate axis only).
vi.mock('@/lib/useCustomerLookups', () => ({
  useCustomerLookups: () => ({
    statuses: [
      { value: 'active', label: 'Actief' },
      { value: 'inactive', label: 'Inactief' },
    ],
  }),
}))

// Controllable settings blob + a spy on the save path (§13: assert the REQUEST).
const mockSettings = vi.fn(() => ({}))
const saveSettingsKeys = vi.fn(async () => {})
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => mockSettings(),
  saveSettingsKeys: (...args) => saveSettingsKeys(...args),
  invalidateAllSettingsCache: vi.fn(),
}))

describe('CustomerConversionSettings · absent setting is the honest "none" state', () => {
  it('shows "None" when nothing is configured yet', () => {
    mockSettings.mockReturnValue({})
    render(<CustomerConversionSettings />)
    expect(screen.getByRole('button', { name: st('customerConversion.none') })).toBeInTheDocument()
  })
})

describe('CustomerConversionSettings · renders a stored value as selected', () => {
  it('shows the stored status label as the trigger, not "None"', () => {
    mockSettings.mockReturnValue({ [CONVERT_DEFAULT_STATUS_KEY]: 'inactive' })
    render(<CustomerConversionSettings />)
    expect(screen.getByRole('button', { name: 'Inactief' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: st('customerConversion.none') })).not.toBeInTheDocument()
  })
})

describe('CustomerConversionSettings · writes the key on save', () => {
  it('persists the picked status under customer_default_status_on_convert', async () => {
    mockSettings.mockReturnValue({})
    const user = userEvent.setup()
    render(<CustomerConversionSettings />)

    await user.click(screen.getByRole('button', { name: st('customerConversion.none') }))
    await user.click(screen.getByRole('button', { name: 'Inactief' }))

    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalledWith({ [CONVERT_DEFAULT_STATUS_KEY]: 'inactive' }))
  })
})
