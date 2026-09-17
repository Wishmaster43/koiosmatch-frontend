/**
 * TenantSwitcher — DRY round 11 (LAYOUT) adopted the shared useClickOutside
 * hook for its close-on-outside-click wiring (previously a hand-rolled
 * effect); this test proves the picker still opens/closes on outside click
 * for a super admin, since the component had no prior test coverage at all.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import api from '@/lib/api'
import TenantSwitcher from './TenantSwitcher'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)

// Super admin, active tenant "Yesway" — the only role that can open the picker.
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    activeTenant: { id: 't1', name: 'Yesway Flex B.V.' },
    user: { id: 'u1' },
    setActiveTenant: vi.fn(),
    isSuperAdmin: () => true,
  }),
}))

describe('TenantSwitcher', () => {
  it('opens the picker on click and closes it on an outside click', async () => {
    mockedGet.mockResolvedValue({ data: { data: [], meta: { total: 0, current_page: 1, last_page: 1 } } })
    render(
      <div>
        <TenantSwitcher expanded />
        <div data-testid="outside">outside</div>
      </div>,
    )

    await userEvent.click(screen.getByText('Yesway Flex B.V.'))
    expect(screen.getByPlaceholderText('nav.switchTenant')).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('outside'))
    await waitFor(() => expect(screen.queryByPlaceholderText('nav.switchTenant')).not.toBeInTheDocument())
  })

  it('does not close when clicking inside the search input itself', async () => {
    mockedGet.mockResolvedValue({ data: { data: [], meta: { total: 0, current_page: 1, last_page: 1 } } })
    render(<TenantSwitcher expanded />)

    await userEvent.click(screen.getByText('Yesway Flex B.V.'))
    const input = screen.getByPlaceholderText('nav.switchTenant')
    await userEvent.click(input)
    expect(screen.getByPlaceholderText('nav.switchTenant')).toBeInTheDocument()
  })

  // A failed GET /tenants must render an honest error, never the same
  // "no agencies" copy a true empty result shows (§3 four UI states).
  it('shows an error notice (not the empty-state copy) when the tenant fetch fails', async () => {
    mockedGet.mockRejectedValue(new Error('network down'))
    render(<TenantSwitcher expanded />)

    await userEvent.click(screen.getByText('Yesway Flex B.V.'))
    await waitFor(() => expect(screen.getByText('error.loadFailed')).toBeInTheDocument())
    expect(screen.queryByText('noAgencies')).not.toBeInTheDocument()
  })
})
