/** TenantPickPage — picker wall: pick gating, setActiveTenant call, error state, sign-out, null auth. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TenantPickPage from './TenantPickPage'
import { useAuth } from '@/context/AuthContext'
import { useTenantSearch } from '@/hooks/useTenantSearch'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/hooks/useTenantSearch', () => ({ useTenantSearch: vi.fn() }))
// The heavy picker is stubbed: options render as buttons that call onToggle.
vi.mock('@/components/ui/SearchSelect', () => ({
  default: ({ options, onToggle, triggerLabel }: { options: Array<{ value: string; label: string; disabled?: boolean; badge?: React.ReactNode }>; onToggle: (v: string) => void; triggerLabel: string }) => (
    <div><span>{triggerLabel}</span>{options.map(o => <button key={o.value} disabled={o.disabled} onClick={() => onToggle(o.value)}>{o.label}{o.badge}</button>)}</div>
  ),
}))

const setActiveTenant = vi.fn()
const logout = vi.fn()
const search = (error = false) => vi.mocked(useTenantSearch).mockReturnValue(
  { options: [{ value: 't1', label: 'Bureau Een' }], onSearch: vi.fn(), error })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAuth).mockReturnValue({ setActiveTenant, logout } as unknown as ReturnType<typeof useAuth>)
  search()
})

describe('TenantPickPage', () => {
  it('renders the title and keeps continue disabled before a pick', () => {
    render(<TenantPickPage />)
    expect(screen.getByText('tenantPick.title')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tenantPick.continue/ })).toBeDisabled()
  })

  it('calls setActiveTenant with the picked bureau', async () => {
    const user = userEvent.setup()
    render(<TenantPickPage />)
    await user.click(screen.getByText('Bureau Een'))
    await user.click(screen.getByRole('button', { name: /tenantPick.continue/ }))
    expect(setActiveTenant).toHaveBeenCalledWith({ id: 't1', name: 'Bureau Een' })
  })

  it('shows the load failure instead of an empty list', () => {
    search(true)
    render(<TenantPickPage />)
    expect(screen.getByText('tenantPick.loadFailed')).toBeInTheDocument()
  })

  it('signs out', async () => {
    const user = userEvent.setup()
    render(<TenantPickPage />)
    await user.click(screen.getByRole('button', { name: /tenantPick.signOut/ }))
    expect(logout).toHaveBeenCalled()
  })

  it('renders nothing without auth context', () => {
    vi.mocked(useAuth).mockReturnValue(null as unknown as ReturnType<typeof useAuth>)
    const { container } = render(<TenantPickPage />)
    expect(container).toBeEmptyDOMElement()
  })
})

// BE lane F B-002: pending/failed bureaus are shown inert with a chip; the not-ready notice explains the wall.
describe('TenantPickPage provisioning', () => {
  const mixed = () => vi.mocked(useTenantSearch).mockReturnValue({
    options: [
      { value: 't1', label: 'Bureau Een', provisioningStatus: null },
      { value: 't2', label: 'Bureau Twee', provisioningStatus: 'pending' },
      { value: 't3', label: 'Bureau Drie', provisioningStatus: 'failed' },
    ], onSearch: vi.fn(), error: false })

  it('disables pending and failed rows with their chip, keeps ready rows pickable', async () => {
    mixed()
    const user = userEvent.setup()
    render(<TenantPickPage />)
    expect(screen.getByRole('button', { name: /Bureau Twee/ })).toBeDisabled()
    expect(screen.getByText('tenantPick.statusPending')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bureau Drie/ })).toBeDisabled()
    expect(screen.getByText('tenantPick.statusFailed')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Bureau Een/ }))
    await user.click(screen.getByRole('button', { name: /tenantPick.continue/ }))
    expect(setActiveTenant).toHaveBeenCalledWith({ id: 't1', name: 'Bureau Een' })
  })

  it('shows the not-ready notice only for the tenant_not_ready code', () => {
    sessionStorage.setItem('km_tenant_pick_code', 'tenant_required')
    const { unmount } = render(<TenantPickPage />)
    expect(screen.queryByText('tenantPick.notReadyNotice')).not.toBeInTheDocument()
    unmount()
    sessionStorage.setItem('km_tenant_pick_code', 'tenant_not_ready')
    render(<TenantPickPage />)
    expect(screen.getByText('tenantPick.notReadyNotice')).toBeInTheDocument()
    sessionStorage.removeItem('km_tenant_pick_code')
  })

  it('consumes the stored code on mount so a second wall shows no stale notice', () => {
    sessionStorage.setItem('km_tenant_pick_code', 'tenant_not_ready')
    const { unmount } = render(<TenantPickPage />)
    expect(screen.getByText('tenantPick.notReadyNotice')).toBeInTheDocument()
    expect(sessionStorage.getItem('km_tenant_pick_code')).toBeNull()
    unmount()
    render(<TenantPickPage />)
    expect(screen.queryByText('tenantPick.notReadyNotice')).not.toBeInTheDocument()
  })
})
