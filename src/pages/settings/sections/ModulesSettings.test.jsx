/**
 * ModulesSettings — audit finding: the tier picker (hand-rolled radio cards, hardcoded
 * white check) and the add-on switch (hand-rolled toggle, hardcoded white thumb) now
 * use the shared SegmentedControl / Toggle. Covers the same tier/addon payload the
 * hand-rolled version sent, plus the stopPropagation regression guard: clicking the
 * Toggle directly must not ALSO fire the row's own onClick (which would silently
 * toggle the addon back off in the same click).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ModulesSettings from './ModulesSettings'

const mockGet = vi.fn()
const mockPut = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...a) => mockGet(...a), put: (...a) => mockPut(...a) } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))
const mockRefreshUser = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ activeTenant: { id: 't1' }, refreshUser: mockRefreshUser }) }))

beforeEach(() => { mockGet.mockReset(); mockPut.mockReset(); mockRefreshUser.mockReset() })

describe('ModulesSettings', () => {
  it('renders the seeded tier as the checked SegmentedControl radio', async () => {
    mockGet.mockResolvedValue({ data: { package: 'pro', addons: ['reports'] } })
    render(<ModulesSettings />)

    const proRadio = await screen.findByRole('radio', { name: /Koios Pro/ })
    expect(proRadio).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Koios Core/ })).toHaveAttribute('aria-checked', 'false')
  })

  it('picking a different tier and saving PUTs the new package', async () => {
    mockGet.mockResolvedValue({ data: { package: 'core', addons: [] } })
    mockPut.mockResolvedValue({ data: {} })
    render(<ModulesSettings />)

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

    const reportsToggle = await screen.findByRole('switch', { name: 'modules.addon.reports' })
    fireEvent.click(reportsToggle)
    fireEvent.click(screen.getByText('modules.activate'))

    await waitFor(() => expect(mockPut).toHaveBeenCalledWith(
      '/tenant-modules', expect.objectContaining({ addons: ['reports'] })))
  })
})
