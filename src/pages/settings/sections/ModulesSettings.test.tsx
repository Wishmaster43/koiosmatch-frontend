/**
 * ModulesSettings — audit finding: the tier picker (hand-rolled radio cards, hardcoded
 * white check) and the add-on switch (hand-rolled toggle, hardcoded white thumb) now
 * use the shared SegmentedControl / Toggle. Covers the same tier/addon payload the
 * hand-rolled version sent, plus the stopPropagation regression guard: clicking the
 * Toggle directly must not ALSO fire the row's own onClick (which would silently
 * toggle the addon back off in the same click). Add-on names and descriptions now come
 * from i18n (modules.addon.{id} and modules.addonDesc.{id}) instead of hardcoded.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ModulesSettings from './ModulesSettings'

const mockGet = vi.fn()
const mockPut = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => mockGet(...a), put: (...a: unknown[]) => mockPut(...a) } }))
// Mock i18n to return keys as-is (like translation keys), so we can find elements by key names in tests.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('./tiers/BillingTiersCard', () => ({ default: () => <div data-testid="billing-tiers-card" /> }))
vi.mock('@/i18n', () => ({ LOCALE_BY_LANG: { nl: 'nl-NL', en: 'en-GB' } }))
const mockRefreshUser = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ activeTenant: { id: 't1' }, refreshUser: mockRefreshUser }) }))

beforeEach(() => { mockGet.mockReset(); mockPut.mockReset(); mockRefreshUser.mockReset() })

describe('ModulesSettings', () => {
  it('renders the seeded tier as the checked SegmentedControl radio', async () => {
    mockGet.mockResolvedValue({ data: { package: 'pro', addons: ['reports'] } })
    render(<ModulesSettings />)
    // MODULES-SUBTABS-1: the package group sits behind its own sub-tab now.
    await userEvent.click(await screen.findByRole('tab', { name: 'modules.tabs.package' }))

    const proRadio = await screen.findByRole('radio', { name: /Koios Pro/ })
    expect(proRadio).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Koios Core/ })).toHaveAttribute('aria-checked', 'false')
  })

  it('picking a different tier and saving PUTs the new package', async () => {
    mockGet.mockResolvedValue({ data: { package: 'core', addons: [] } })
    mockPut.mockResolvedValue({ data: {} })
    render(<ModulesSettings />)
    // MODULES-SUBTABS-1: the package group sits behind its own sub-tab now.
    await userEvent.click(await screen.findByRole('tab', { name: 'modules.tabs.package' }))

    await screen.findByRole('radio', { name: /Koios Core/ })
    fireEvent.click(screen.getByRole('radio', { name: /Koios Enterprise/ }))
    fireEvent.click(screen.getByText('modules.activate'))

    await waitFor(() => expect(mockPut).toHaveBeenCalledWith(
      '/tenant-modules', expect.objectContaining({ tenant_id: 't1', package: 'enterprise', addons: [] })))
  })

  // Regression guard for the stopPropagation fix: clicking the Toggle switch itself
  // must add exactly ONE addon, not toggle it on then immediately back off via the
  // row's own bubbling onClick.
  it('clicking the addon Toggle switch toggles it exactly once, not twice', async () => {
    mockGet.mockResolvedValue({ data: { package: 'core', addons: [] } })
    mockPut.mockResolvedValue({ data: {} })
    render(<ModulesSettings />)
    // MODULES-SUBTABS-1: the package group sits behind its own sub-tab now.
    await userEvent.click(await screen.findByRole('tab', { name: 'modules.tabs.package' }))

    const reportsToggle = await screen.findByRole('switch', { name: 'modules.addon.reports' })
    fireEvent.click(reportsToggle)
    fireEvent.click(screen.getByText('modules.activate'))

    await waitFor(() => expect(mockPut).toHaveBeenCalledWith(
      '/tenant-modules', expect.objectContaining({ addons: ['reports'] })))
  })

  // MODULES-USERS-SUBTAB-1 + TASK F (30-08, tiers sub-tab placed second):
  // the five sub-tabs render in order pricing, tiers, budgets, package, users.
  it('renders the users sub-tab after package', async () => {
    mockGet.mockResolvedValue({ data: { package: 'core', addons: [] } })
    render(<ModulesSettings />)
    const tabs = await screen.findAllByRole('tab')
    const labels = tabs.map((tab) => tab.textContent)
    expect(labels).toEqual([
      'modules.tabs.pricing', 'modules.tabs.tiers', 'modules.tabs.budgets',
      'modules.tabs.package', 'modules.tabs.users',
    ])
  })

  // TASK F: the new 'tiers' sub-tab renders the (mocked) BillingTiersCard.
  it('renders BillingTiersCard on the tiers sub-tab', async () => {
    mockGet.mockResolvedValue({ data: { package: 'core', addons: [] } })
    render(<ModulesSettings />)
    await userEvent.click(await screen.findByRole('tab', { name: 'modules.tabs.tiers' }))
    expect(await screen.findByTestId('billing-tiers-card')).toBeInTheDocument()
  })

  // Add-on names and descriptions are now from i18n modules.addon.{id} and modules.addonDesc.{id}.
  // The invoicing add-on is a new entry that uses the Receipt icon.
  it('renders the invoicing add-on with other add-ons', async () => {
    mockGet.mockResolvedValue({ data: { package: 'pro', addons: [] } })
    render(<ModulesSettings />)
    await userEvent.click(await screen.findByRole('tab', { name: 'modules.tabs.package' }))

    const switches = await screen.findAllByRole('switch')
    // Expect 5 switches: reports, sm, hf, plan, invoicing
    expect(switches).toHaveLength(5)
    // Invoicing should be the 5th switch
    expect(switches[4]).toHaveAttribute('aria-label', 'modules.addon.invoicing')
  })

  // Legacy package notice: when package is null, display a migration prompt.
  it('renders a legacy package notice when package is null', async () => {
    mockGet.mockResolvedValue({ data: { package: null, addons: [] } })
    render(<ModulesSettings />)
    await userEvent.click(await screen.findByRole('tab', { name: 'modules.tabs.package' }))

    expect(await screen.findByText('modules.legacyPackage')).toBeInTheDocument()
  })

  // No legacy notice when package is a valid tier.
  it('does not render legacy notice for valid packages', async () => {
    mockGet.mockResolvedValue({ data: { package: 'enterprise', addons: ['reports'] } })
    render(<ModulesSettings />)
    await userEvent.click(await screen.findByRole('tab', { name: 'modules.tabs.package' }))

    const notices = screen.queryAllByText('modules.legacyPackage')
    expect(notices).toHaveLength(0)
  })
})
