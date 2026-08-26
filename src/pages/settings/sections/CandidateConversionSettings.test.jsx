/**
 * CandidateConversionSettings — mirrors CustomerConversionSettings.test.jsx.
 * Covers the seeded default, reading back a stored value, and writing the key
 * on save (§13: assert the REQUEST). No test file existed for this screen
 * before the STALE-INIT-1 fix (`useState(saved)` froze the seed default
 * forever on a cold cache) — this closes that gap.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { CandidateConversionSettings, CONVERT_DEFAULT_STATUS_KEY } from './CandidateConversionSettings'

const st = key => i18n.t(key, { ns: 'settings' })

// Candidate deployability status lookup — plain values only; requires_match/
// is_blacklist statuses are filtered out by the component itself.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({
    statuses: [
      { value: 'available', label: 'Beschikbaar' },
      { value: 'unavailable', label: 'Niet beschikbaar' },
    ],
  }),
}))

// Controllable settings blob + a spy on the save path (§13: assert the REQUEST).
const mockSettings = vi.fn(() => ({}))
const saveSettingsKeys = vi.fn(async () => {})
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => mockSettings(),
  // STALE-INIT-1: this test assumes the settings blob has already resolved.
  useSettingsLoaded: () => true,
  saveSettingsKeys: (...args) => saveSettingsKeys(...args),
  invalidateAllSettingsCache: vi.fn(),
}))

describe('CandidateConversionSettings · seeded default when nothing is configured', () => {
  it('shows the "Available" seed default', () => {
    mockSettings.mockReturnValue({})
    render(<CandidateConversionSettings />)
    expect(screen.getByRole('button', { name: 'Beschikbaar' })).toBeInTheDocument()
  })
})

describe('CandidateConversionSettings · renders a stored value as selected', () => {
  it('shows the stored status label as the trigger, not the seed default', () => {
    mockSettings.mockReturnValue({ [CONVERT_DEFAULT_STATUS_KEY]: 'unavailable' })
    render(<CandidateConversionSettings />)
    expect(screen.getByRole('button', { name: 'Niet beschikbaar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Beschikbaar' })).not.toBeInTheDocument()
  })
})

describe('CandidateConversionSettings · writes the key on save', () => {
  it('persists the picked status under candidate_default_status_on_convert', async () => {
    mockSettings.mockReturnValue({})
    const user = userEvent.setup()
    render(<CandidateConversionSettings />)

    await user.click(screen.getByRole('button', { name: 'Beschikbaar' }))
    await user.click(screen.getByRole('button', { name: 'Niet beschikbaar' }))

    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalledWith({ [CONVERT_DEFAULT_STATUS_KEY]: 'unavailable' }))
  })
})

describe('CandidateConversionSettings · none option', () => {
  it('offers "None" (leave the status empty) alongside the real statuses', async () => {
    mockSettings.mockReturnValue({})
    const user = userEvent.setup()
    render(<CandidateConversionSettings />)

    await user.click(screen.getByRole('button', { name: 'Beschikbaar' }))
    expect(await screen.findByRole('button', { name: st('candidateConversion.none') })).toBeInTheDocument()
  })
})
