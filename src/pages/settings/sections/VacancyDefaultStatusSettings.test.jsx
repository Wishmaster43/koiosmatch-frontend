/**
 * VacancyDefaultStatusSettings (VACSTATUS-DEFAULT-1) — the tenant-setting picker for
 * the status a freshly created vacancy gets when the create request omits one,
 * mirroring CustomerConversionSettings' own tests. `/vacancy-statuses` is left
 * unresolved so VacancyLookupsProvider stays on its seed fallback (open/online/
 * concept/paused/closed — mirrors VacancyCandidateTabSettings.test.jsx) — a real
 * network mock isn't needed to prove the picker reads/writes the right settings key.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import VacancyDefaultStatusSettings, { VACANCY_DEFAULT_STATUS_KEY } from './VacancyDefaultStatusSettings'

const st = key => i18n.t(key, { ns: 'settings' })

// Never resolves — VacancyLookupsProvider keeps its DEFAULT_VACANCY_STATUSES seed.
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => new Promise(() => {})) } }))

// Controllable settings blob + a spy on the save path (§13: assert the REQUEST).
const mockSettings = vi.fn(() => ({}))
const saveSettingsKeys = vi.fn(async () => {})
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => mockSettings(),
  saveSettingsKeys: (...args) => saveSettingsKeys(...args),
  invalidateAllSettingsCache: vi.fn(),
}))

afterEach(() => vi.clearAllMocks())

describe('VacancyDefaultStatusSettings · absent setting is the honest "none" state', () => {
  it('shows "None" when nothing is configured yet', () => {
    mockSettings.mockReturnValue({})
    render(<VacancyDefaultStatusSettings />)
    expect(screen.getByRole('button', { name: st('vacancyDefaultStatus.none') })).toBeInTheDocument()
  })
})

describe('VacancyDefaultStatusSettings · renders a stored value as selected', () => {
  it('shows the stored status label as the trigger, not "None"', () => {
    mockSettings.mockReturnValue({ [VACANCY_DEFAULT_STATUS_KEY]: 'open' })
    render(<VacancyDefaultStatusSettings />)
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: st('vacancyDefaultStatus.none') })).not.toBeInTheDocument()
  })
})

describe('VacancyDefaultStatusSettings · writes the key on save', () => {
  it('persists the picked status under vacancy_default_status_on_create', async () => {
    mockSettings.mockReturnValue({})
    const user = userEvent.setup()
    render(<VacancyDefaultStatusSettings />)

    await user.click(screen.getByRole('button', { name: st('vacancyDefaultStatus.none') }))
    await user.click(await screen.findByRole('button', { name: 'Concept' }))

    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalledWith({ [VACANCY_DEFAULT_STATUS_KEY]: 'concept' }))
  })
})
