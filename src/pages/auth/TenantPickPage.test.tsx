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
  default: ({ options, onToggle, triggerLabel }: { options: Array<{ value: string; label: string }>; onToggle: (v: string) => void; triggerLabel: string }) => (
    <div><span>{triggerLabel}</span>{options.map(o => <button key={o.value} onClick={() => onToggle(o.value)}>{o.label}</button>)}</div>
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
